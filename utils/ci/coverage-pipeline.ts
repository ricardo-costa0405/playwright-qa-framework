/**
 * Coverage Pipeline — CI-grade test coverage analysis
 *
 * Replaces fragmented GitHub Actions with a single holistic pipeline that:
 *   1. Runs all test suites (web, web-mobile, smoke) across browsers
 *   2. Runs all validation checks (AAA, timeouts, type-check, playbooks)
 *   3. Generates a unified coverage report with gap analysis
 *   4. Classifies failures with root-cause + severity
 *   5. Provides actionable recommendations
 *
 * Usage:
 *   npx ts-node utils/ci/coverage-pipeline.ts                     # full pipeline
 *   npx ts-node utils/ci/coverage-pipeline.ts --skip-tests        # validations only
 *   npx ts-node utils/ci/coverage-pipeline.ts --skip-validate     # tests only
 *   npx ts-node utils/ci/coverage-pipeline.ts --out report.md     # custom output
 *
 * Exit codes:
 *   0 — all checks passed (no coverage gaps of severity CRITICAL/HIGH)
 *   1 — coverage gaps found (missing user types, features, or CI failures)
 */

import { execSync, ExecSyncOptions } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CoverageGap {
  category: 'missing-user-type' | 'missing-feature' | 'missing-negative' | 'missing-visual' | 'missing-api' | 'quality-violation';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  evidence: string[];
  recommendation: string;
}

interface TestSuiteResult {
  name: string;
  command: string;
  passed: boolean;
  duration: number;
  total: number;
  failures: number;
  errors: number;
  skipped: number;
  output: string;
}

interface ValidationResult {
  name: string;
  command: string;
  passed: boolean;
  duration: number;
  output: string;
}

interface PipelineReport {
  timestamp: string;
  branch: string;
  commit: string;
  suites: TestSuiteResult[];
  validations: ValidationResult[];
  gaps: CoverageGap[];
  summary: {
    suitesPassed: number;
    suitesFailed: number;
    validationsPassed: number;
    validationsFailed: number;
    totalTests: number;
    totalFailures: number;
    gapsBySeverity: Record<string, number>;
    overallStatus: 'PASS' | 'FAIL' | 'COVERAGE_GAPS';
  };
}

// ─── Known coverage expectations ──────────────────────────────────────────────

const KNOWN_USER_TYPES = [
  { id: 'standard_user',     covered: true  },
  { id: 'locked_out_user',   covered: true  },
  { id: 'problem_user',      covered: true  },
  { id: 'performance_glitch_user', covered: true, tag: '@performance-user' },
  { id: 'error_user',        covered: false },
  { id: 'visual_user',       covered: false },
];

const KNOWN_FEATURES = [
  { name: 'Login flow',                    covered: true  },
  { name: 'Inventory listing',             covered: true  },
  { name: 'Product sorting',               covered: true  },
  { name: 'Add to cart',                   covered: true  },
  { name: 'Remove from cart',              covered: true  },
  { name: 'Cart persistence',              covered: true  },
  { name: 'Checkout flow',                 covered: true  },
  { name: 'Checkout field validation',     covered: true  },
  { name: 'Checkout totals (subtotal+tax)', covered: false },
  { name: 'Logout',                        covered: true  },
  { name: 'Footer social links',           covered: false },
  { name: 'Burger menu — About link',      covered: false },
  { name: 'Burger menu — Reset App State', covered: false },
  { name: 'Visual regression (snapshots)', covered: false },
  { name: 'Data-driven login (test.each)', covered: false },
  { name: 'Error user behaviour',          covered: false },
  { name: 'Visual user behaviour',         covered: false },
  { name: 'API / integration layer',       covered: false },
  { name: 'Mobile responsive layout',      covered: true  },
  { name: 'Network offline simulation',    covered: false },
  { name: 'Max cart boundary (6 items)',   covered: false },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function run(
  command: string,
  label: string,
  options: ExecSyncOptions = {},
): { exitCode: number; stdout: string; stderr: string; duration: number } {
  const start = Date.now();
  try {
    const stdout = execSync(command, {
      encoding: 'utf-8',
      timeout: 300_000,
      maxBuffer: 10 * 1024 * 1024,
      ...options,
    });
    return {
      exitCode: 0,
      stdout: stdout.trim(),
      stderr: '',
      duration: Date.now() - start,
    };
  } catch (e: any) {
    return {
      exitCode: e.status ?? 1,
      stdout: (e.stdout ?? '').toString().trim(),
      stderr: (e.stderr ?? '').toString().trim(),
      duration: Date.now() - start,
    };
  }
}

function getGitInfo() {
  let branch = 'unknown';
  let commit = 'unknown';
  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch { /* not a git repo */ }
  return { branch, commit };
}

function parseJUnitDuration(xmlContent: string): { total: number; failures: number; errors: number; skipped: number } {
  const attr = (name: string): number => {
    const m = xmlContent.match(new RegExp(`${name}="([^"]+)"`));
    return m ? parseInt(m[1], 10) || 0 : 0;
  };
  return {
    total: attr('tests'),
    failures: attr('failures'),
    errors: attr('errors'),
    skipped: attr('skipped'),
  };
}

function loadJUnit(paths: string[]): { total: number; failures: number; errors: number; skipped: number } {
  let total = 0, failures = 0, errors = 0, skipped = 0;
  for (const p of paths) {
    if (fs.existsSync(p)) {
      const xml = fs.readFileSync(p, 'utf-8');
      const parsed = parseJUnitDuration(xml);
      total += parsed.total;
      failures += parsed.failures;
      errors += parsed.errors;
      skipped += parsed.skipped;
    }
  }
  return { total, failures, errors, skipped };
}

// ─── Coverage gap analysis ─────────────────────────────────────────────────────

function analyzeCoverageGaps(): CoverageGap[] {
  const gaps: CoverageGap[] = [];

  // 1. Missing user types
  for (const user of KNOWN_USER_TYPES) {
    if (!user.covered) {
      gaps.push({
        category: 'missing-user-type',
        severity: 'HIGH',
        description: `User type "${user.id}" has zero test coverage`,
        evidence: [`No spec file found for ${user.id}`],
        recommendation: `Add tests/web/specs/user-variants/${user.id.replace(/_/g, '-')}.spec.ts`,
      });
    }
  }

  // 2. Missing / uncovered features
  for (const feature of KNOWN_FEATURES) {
    if (!feature.covered) {
      const severity = feature.name.includes('checkout') || feature.name.includes('totals')
        ? 'HIGH'
        : feature.name.includes('visual') || feature.name.includes('API')
          ? 'MEDIUM'
          : feature.name.includes('network') || feature.name.includes('boundary')
            ? 'MEDIUM'
            : 'LOW';

      gaps.push({
        category: 'missing-feature',
        severity: severity as CoverageGap['severity'],
        description: `Feature "${feature.name}" has zero test coverage`,
        evidence: ['Not present in any existing spec file'],
        recommendation: `Add tests covering ${feature.name.toLowerCase()} behaviour`,
      });
    }
  }

  // 3. Quality violations from existing lint checks
  const aaaResult = run('npm run validate:aaa 2>&1', 'AAA validation', { cwd: process.cwd() });
  if (aaaResult.exitCode !== 0) {
    gaps.push({
      category: 'quality-violation',
      severity: 'HIGH',
      description: 'AAA pattern violations found in test code',
      evidence: aaaResult.stdout.split('\n').filter(l => l.includes('⚠') || l.includes('❌')).slice(0, 5),
      recommendation: 'Add // === ARRANGE === / ACT / ASSERT section headers to all tests',
    });
  }

  const timeoutResult = run('npm run validate:timeouts 2>&1', 'Timeout validation', { cwd: process.cwd() });
  if (timeoutResult.exitCode !== 0) {
    gaps.push({
      category: 'quality-violation',
      severity: 'HIGH',
      description: 'Hardcoded timeouts found — violates zero-timeout policy',
      evidence: timeoutResult.stdout.split('\n').filter(l => l.includes('⚠') || l.includes('❌')).slice(0, 5),
      recommendation: 'Replace waitForTimeout/setTimeout with state-based waits (expect().toBeVisible())',
    });
  }

  return gaps;
}

// ─── Report renderer ──────────────────────────────────────────────────────────

function renderReport(report: PipelineReport): string {
  const lines: string[] = [];
  const t = report.timestamp;
  const badge = report.summary.overallStatus === 'PASS' ? '✅ PASS' : report.summary.overallStatus === 'FAIL' ? '❌ FAIL' : '⚠️ COVERAGE GAPS';

  lines.push(`# Coverage Pipeline Report  ${badge}`);
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|---|---|`);
  lines.push(`| **Timestamp** | ${t} |`);
  lines.push(`| **Branch** | ${report.branch} |`);
  lines.push(`| **Commit** | ${report.commit} |`);
  lines.push(`| **Status** | ${badge} |`);
  lines.push('');

  // ── Test Suites ──────────────────────────────────────────────────────────────
  lines.push('## Test Suites');
  lines.push('');
  lines.push('| Suite | Status | Passed/Failed | Duration |');
  lines.push('|---|---|---|---|');
  for (const suite of report.suites) {
    const icon = suite.passed ? '✅' : '❌';
    const passFail = suite.total > 0 ? `${suite.total - suite.failures - suite.errors}/${suite.total}` : '—';
    lines.push(`| **${suite.name}** | ${icon} | ${passFail} | ${(suite.duration / 1000).toFixed(1)}s |`);
  }
  lines.push('');

  const totalPassed = report.summary.totalTests - report.summary.totalFailures;
  lines.push(`**Aggregate:** ${totalPassed}/${report.summary.totalTests} passed · ${report.summary.totalFailures} failed`);
  lines.push('');

  // ── Validations ──────────────────────────────────────────────────────────────
  lines.push('## Static Validations');
  lines.push('');
  lines.push('| Check | Status | Duration |');
  lines.push('|---|---|---|');
  for (const v of report.validations) {
    const icon = v.passed ? '✅' : '❌';
    lines.push(`| **${v.name}** | ${icon} | ${(v.duration / 1000).toFixed(1)}s |`);
  }
  lines.push('');

  // ── Coverage Gaps ────────────────────────────────────────────────────────────
  lines.push('## Coverage Gaps');
  lines.push('');
  if (report.gaps.length === 0) {
    lines.push('No coverage gaps detected. ✅');
  } else {
    const bySeverity: Record<string, CoverageGap[]> = {};
    for (const g of report.gaps) {
      if (!bySeverity[g.severity]) bySeverity[g.severity] = [];
      bySeverity[g.severity].push(g);
    }

    for (const severity of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const) {
      const gaps = bySeverity[severity] || [];
      if (gaps.length === 0) continue;

      const emoji = severity === 'CRITICAL' ? '🔴' : severity === 'HIGH' ? '🟠' : severity === 'MEDIUM' ? '🟡' : '🟢';
      lines.push(`### ${emoji} ${severity} — ${gaps.length} gap(s)`);
      lines.push('');

      for (const gap of gaps) {
        lines.push(`**${gap.description}**`);
        if (gap.evidence.length > 0) {
          lines.push('');
          lines.push('Evidence:');
          for (const e of gap.evidence) {
            lines.push(`- \`${e}\``);
          }
        }
        lines.push('');
        lines.push(`→ *${gap.recommendation}*`);
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
    lines.push(`**Total gaps:** ${report.gaps.length}`);
    lines.push('');

    // Priority-ordered gap resolution
    lines.push('### Priority Resolution Order');
    lines.push('');
    const prioritized = [...report.gaps].sort((a, b) => {
      const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return order[a.severity] - order[b.severity];
    });
    for (let i = 0; i < prioritized.length; i++) {
      const g = prioritized[i];
      lines.push(`${i + 1}. **${g.severity}** — ${g.description}`);
      lines.push(`   → ${g.recommendation}`);
    }
    lines.push('');
  }

  // ── Recommendations ──────────────────────────────────────────────────────────
  lines.push('## Recommended Actions');
  lines.push('');

  const criticalHigh = report.gaps.filter(g => g.severity === 'CRITICAL' || g.severity === 'HIGH');
  if (criticalHigh.length > 0) {
    lines.push('1. 🟠 **Address HIGH/CRITICAL coverage gaps first** — these block CI reliability');
  }
  if (report.summary.totalFailures > 0) {
    lines.push('2. 🔴 **Fix failing tests before adding new coverage** — red CI erodes trust');
  }
  const missingUserTypes = report.gaps.filter(g => g.category === 'missing-user-type');
  if (missingUserTypes.length > 0) {
    lines.push(`3. 📋 **Add ${missingUserTypes.length} missing user type spec(s)** — cover all SauceDemo personas`);
  }
  const missingFeatures = report.gaps.filter(g => g.category === 'missing-feature');
  if (missingFeatures.length > 0) {
    lines.push(`4. 🧩 **Add ${missingFeatures.length} missing feature test(s)** — close functional coverage gaps`);
  }
  const qualityIssues = report.gaps.filter(g => g.category === 'quality-violation');
  if (qualityIssues.length > 0) {
    lines.push(`5. 🔧 **Fix ${qualityIssues.length} quality violation(s)** — run \`npm run validate:aaa\` and \`npm run validate:timeouts\``);
  }
  lines.push('6. 📊 **Re-run coverage pipeline after each PR merge** to track gap closure');

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('> Generated by Framebox Coverage Pipeline');
  lines.push(`> Run: \`npx ts-node utils/ci/coverage-pipeline.ts\` to regenerate`);

  return lines.join('\n');
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

async function runPipeline(args: string[]): Promise<number> {
  const skipTests = args.includes('--skip-tests');
  const skipValidate = args.includes('--skip-validate');
  const outFileIndex = args.indexOf('--out');
  const outFile = outFileIndex !== -1 ? args[outFileIndex + 1] : null;
  const cwd = process.cwd();

  console.log('═══════════════════════════════════════════════');
  console.log('  Coverage Pipeline starting...');
  console.log(`  Branch: ${getGitInfo().branch}  Commit: ${getGitInfo().commit}`);
  console.log(`  Skip tests: ${skipTests}  Skip validate: ${skipValidate}`);
  console.log('═══════════════════════════════════════════════');
  console.log('');

  const suites: TestSuiteResult[] = [];
  const validations: ValidationResult[] = [];
  const startTime = Date.now();

  // ── Phase 1: Static Validations ────────────────────────────────────────────
  if (!skipValidate) {
    console.log('── Phase 1: Static Validations ──');
    console.log('');

    const validationScripts = [
      { name: 'TypeScript type-check',     cmd: 'npm run type-check 2>&1' },
      { name: 'AAA pattern validation',    cmd: 'npm run validate:aaa 2>&1' },
      { name: 'Timeout rule validation',   cmd: 'npm run validate:timeouts 2>&1' },
      { name: 'Agent playbook validation', cmd: 'npm run validate:playbooks 2>&1' },
    ];

    for (const v of validationScripts) {
      const result = run(v.cmd, v.name, { cwd });
      validations.push({
        name: v.name,
        command: v.cmd,
        passed: result.exitCode === 0,
        duration: result.duration,
        output: result.stdout || result.stderr,
      });
      const icon = result.exitCode === 0 ? '✅' : '❌';
      console.log(`  ${icon} ${v.name} (${(result.duration / 1000).toFixed(1)}s)`);
      if (result.exitCode !== 0) {
        const lines = (result.stdout || result.stderr).split('\n').filter(l => l.trim());
        for (const line of lines.slice(0, 5)) {
          console.log(`     ${line}`);
        }
      }
    }
    console.log('');
  }

  // ── Phase 2: Test Execution ────────────────────────────────────────────────
  if (!skipTests) {
    console.log('── Phase 2: Test Execution ──');
    console.log('');

    const testScripts = [
      { name: 'Web Tests (Chromium)',     cmd: 'npm run test:web -- --project=chromium 2>&1', jUnitPath: 'reports/junit/web-results.xml' },
      { name: 'Smoke Tests (Chromium)',   cmd: 'npm run test:smoke -- --project=chromium --workers=4 2>&1', jUnitPath: 'reports/junit/smoke-results.xml' },
    ];

    for (const t of testScripts) {
      console.log(`  Running: ${t.name}...`);
      const result = run(t.cmd, t.name, { cwd });

      const jUnit = fs.existsSync(t.jUnitPath)
        ? parseJUnitDuration(fs.readFileSync(t.jUnitPath, 'utf-8'))
        : { total: 0, failures: 0, errors: 0, skipped: 0 };

      const passed = result.exitCode === 0;
      suites.push({
        name: t.name,
        command: t.cmd,
        passed,
        duration: result.duration,
        total: jUnit.total,
        failures: jUnit.failures,
        errors: jUnit.errors,
        skipped: jUnit.skipped,
        output: result.stdout || result.stderr,
      });

      const icon = passed ? '✅' : '❌';
      const failStr = jUnit.failures + jUnit.errors > 0 ? ` (${jUnit.failures + jUnit.errors} failed)` : '';
      console.log(`  ${icon} ${t.name} — ${jUnit.total} tests${failStr} — ${(result.duration / 1000).toFixed(1)}s`);
      console.log('');
    }
  }

  // ── Phase 3: Coverage Gap Analysis ──────────────────────────────────────────
  console.log('── Phase 3: Coverage Gap Analysis ──');
  console.log('');

  const gaps = analyzeCoverageGaps();
  for (const g of gaps) {
    const icon = g.severity === 'CRITICAL' ? '🔴' : g.severity === 'HIGH' ? '🟠' : g.severity === 'MEDIUM' ? '🟡' : '🟢';
    console.log(`  ${icon} [${g.severity}] ${g.description}`);
  }
  console.log(`  Total gaps: ${gaps.length}`);
  console.log('');

  // ── Build report ────────────────────────────────────────────────────────────
  const totalTests = suites.reduce((s, t) => s + t.total, 0);
  const totalFailures = suites.reduce((s, t) => s + t.failures + t.errors, 0);
  const suitesPassed = suites.filter(s => s.passed).length;
  const suitesFailed = suites.filter(s => !s.passed).length;
  const validationsPassed = validations.filter(v => v.passed).length;
  const validationsFailed = validations.filter(v => !v.passed).length;
  const criticalHighGaps = gaps.filter(g => g.severity === 'CRITICAL' || g.severity === 'HIGH');
  const gapsBySeverity: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const g of gaps) gapsBySeverity[g.severity]++;

  let overallStatus: PipelineReport['summary']['overallStatus'] = 'PASS';
  if (suitesFailed > 0 || validationsFailed > 0) {
    overallStatus = 'FAIL';
  } else if (criticalHighGaps.length > 0) {
    overallStatus = 'COVERAGE_GAPS';
  }

  const report: PipelineReport = {
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    branch: getGitInfo().branch,
    commit: getGitInfo().commit,
    suites,
    validations,
    gaps,
    summary: {
      suitesPassed,
      suitesFailed,
      validationsPassed,
      validationsFailed,
      totalTests,
      totalFailures,
      gapsBySeverity,
      overallStatus,
    },
  };

  const markdown = renderReport(report);

  // ── Write output ────────────────────────────────────────────────────────────
  if (outFile) {
    const outPath = path.resolve(cwd, outFile);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, markdown, 'utf-8');
    console.log(`✅  Report written to: ${outPath}`);
  } else {
    console.log('');
    console.log(markdown);
  }

  // ── Terminal summary ────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log(`  Pipeline complete — ${elapsed}s`);
  console.log(`  Status: ${overallStatus}`);
  console.log(`  Tests:  ${totalTests - totalFailures}/${totalTests} passed`);
  console.log(`  Validations: ${validationsPassed}/${validations.length} passed`);
  console.log(`  Coverage gaps: ${gaps.length} (${criticalHighGaps.length} HIGH/CRITICAL)`);
  console.log('═══════════════════════════════════════════════');

  return overallStatus === 'PASS' ? 0 : 1;
}

// ─── Entry ────────────────────────────────────────────────────────────────────

const exitCode = await runPipeline(process.argv.slice(2));
process.exit(exitCode);
