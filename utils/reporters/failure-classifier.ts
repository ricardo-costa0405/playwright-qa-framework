/**
 * Playwright Failure Classifier
 *
 * Reads a Playwright JSON report and classifies each failure into:
 *   Selector | Timing | State | Network/API | Assertion | TestDesign
 *
 * Outputs a structured Markdown report matching the QA analysis format.
 *
 * Usage:
 *   npx ts-node utils/reporters/failure-classifier.ts [report.json] [--out report.md] [--json]
 *
 * Defaults:
 *   input  → playwright-report/results.json  (or first positional arg)
 *   output → stdout (markdown)
 *   --json → output raw JSON classification instead of markdown
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────────

type FailureCategory =
  | 'Selector'
  | 'Timing'
  | 'State'
  | 'Network/API'
  | 'Assertion'
  | 'TestDesign';

type Severity = '🔴 Critical' | '🟠 High' | '🟡 Medium' | '🟢 Low';

interface ClassifiedFailure {
  testName: string;
  suiteName: string;
  file: string;
  browser: string;
  category: FailureCategory;
  severity: Severity;
  rootCause: string;
  violation: string | null;
  fix: string;
  errorMessage: string;
  errorSnippet: string | null;
  isFlaky: boolean;       // passed on a later retry
  retryCount: number;
  duration: number;
}

interface PatternSummary {
  selector: number;
  timing: number;
  state: number;
  networkApi: number;
  assertion: number;
  testDesign: number;
  mostAffectedBrowser: string;
  flaky: number;
}

// ─── Playwright JSON schema (minimal) ─────────────────────────────────────────

interface PWError {
  message?: string;
  stack?: string;
  snippet?: string;
  value?: string;
}

interface PWResult {
  workerIndex: number;
  status: 'passed' | 'failed' | 'timedOut' | 'skipped' | 'interrupted';
  duration: number;
  error?: PWError;
  errors: PWError[];
  retry: number;
  startTime: string;
  attachments: unknown[];
  stdout: unknown[];
  stderr: unknown[];
}

interface PWTest {
  timeout: number;
  annotations: unknown[];
  expectedStatus: string;
  projectName: string;
  results: PWResult[];
  status: 'expected' | 'unexpected' | 'flaky' | 'skipped';
}

interface PWSpec {
  title: string;
  ok: boolean;
  tags: string[];
  tests: PWTest[];
  id: string;
  file: string;
  line: number;
  column: number;
}

interface PWSuite {
  title: string;
  file?: string;
  specs: PWSpec[];
  suites?: PWSuite[];
}

interface PWReport {
  config: Record<string, unknown>;
  suites: PWSuite[];
  errors: PWError[];
  stats: {
    startTime: string;
    duration: number;
    expected: number;
    skipped: number;
    unexpected: number;
    flaky: number;
  };
}

// ─── Classification rules ─────────────────────────────────────────────────────

/**
 * Each rule returns true if the error matches the category.
 * Rules are checked in order — first match wins.
 */
const CLASSIFICATION_RULES: Array<{
  category: FailureCategory;
  patterns: RegExp[];
  stackPatterns?: RegExp[];
}> = [
  {
    category: 'Network/API',
    patterns: [
      /net::ERR_/i,
      /ECONNREFUSED/i,
      /ERR_NAME_NOT_RESOLVED/i,
      /socket hang up/i,
      /ECONNRESET/i,
      /ERR_INTERNET_DISCONNECTED/i,
      /Failed to fetch/i,
      /waitForResponse.*timeout/i,
      /Response code [45]\d\d/i,
    ],
  },
  {
    category: 'Selector',
    patterns: [
      /strict mode violation/i,
      /resolved to \d+ elements/i,
      /No element found/i,
      /locator\.nth\(\d+\)/i,
      /Target closed/i,
      /Element is not in DOM/i,
      /Detached/i,
    ],
  },
  {
    category: 'Timing',
    patterns: [
      /Timeout \d+ms exceeded/i,
      /waiting for locator/i,
      /toBeVisible.*timeout/i,
      /toBeHidden.*timeout/i,
      /toHaveText.*timeout/i,
      /toHaveURL.*timeout/i,
      /toBeEnabled.*timeout/i,
      /waitForSelector.*timeout/i,
      /page\.waitForURL.*timeout/i,
      /Exceeded timeout/i,
      /Test timeout of \d+ms exceeded/i,
    ],
  },
  {
    category: 'State',
    patterns: [
      /toHaveURL.*Expected.*Received/is,
      /toHaveText.*Expected.*Received/is,
      /toContainText.*Expected.*Received/is,
      /toEqual.*Expected.*Received/is,
      /Expected URL/i,
      /navigated to/i,
    ],
  },
  {
    category: 'Assertion',
    patterns: [
      /Expected:\s+.+\n\s*Received:/is,
      /expect\(.+\)\.toBe/i,
      /expect\(.+\)\.toEqual/i,
      /expect\(.+\)\.toContain/i,
      /toHaveCount.*Expected/i,
      /Expected \d+, received \d+/i,
    ],
  },
  {
    category: 'TestDesign',
    patterns: [
      /TypeError/i,
      /is not a function/i,
      /Cannot read propert/i,
      /undefined is not/i,
      /null is not/i,
    ],
    stackPatterns: [
      /\.isVisible\(\)/,
      /waitForTimeout/,
      /await.*locator\(/,
    ],
  },
];

const VIOLATION_MAP: Record<FailureCategory, string> = {
  Selector:    'QA Contract — prefer data-test / getByRole; no DOM assumptions',
  Timing:      'QA Contract — always use expect() with retry; no instant assertions',
  State:       'QA Contract — wait for UI state before asserting',
  'Network/API': 'QA Contract — use waitForResponse(); handle slow API responses',
  Assertion:   'QA Contract — use specific matchers; validate expected values',
  TestDesign:  'QA Contract — no .isVisible(), no await locator, no useless assertions',
};

const FIX_TEMPLATE: Record<FailureCategory, string> = {
  Selector:
    'Replace CSS selector with [data-test="…"] or getByRole(). ' +
    'Remove nested .locator().locator() chains.',
  Timing:
    'Replace instant check with `await expect(locator).toBeVisible()` ' +
    'or `await expect(locator).toHaveText("…")` — both retry automatically.',
  State:
    'Replace generic load-state waits with retried assertions such as ' +
    '`await expect(page).toHaveURL(/pattern/)` or `await expect(locator).toBeVisible()`.',
  'Network/API':
    'Use `await page.waitForResponse(url => url.includes("/endpoint"))` ' +
    'before assertions that depend on API data.',
  Assertion:
    'Verify the expected value is correct. ' +
    'Use `toContainText` instead of `toHaveText` for partial matches.',
  TestDesign:
    'Remove `.isVisible()` boolean checks — replace with `await expect(locator).toBeVisible()`. ' +
    'Remove `await` from locator declarations.',
};

// ─── Severity logic ───────────────────────────────────────────────────────────

function deriveSeverity(
  failure: Pick<ClassifiedFailure, 'category' | 'isFlaky' | 'retryCount'>,
  browserCount: number,
): Severity {
  if (browserCount >= 3) return '🔴 Critical';
  if (failure.isFlaky || browserCount === 2) return '🟠 High';
  if (failure.category === 'TestDesign' || failure.retryCount > 0) return '🟡 Medium';
  return '🟢 Low';
}

// ─── Core classifier ──────────────────────────────────────────────────────────

function classifyError(error: PWError): FailureCategory {
  const message = error.message ?? '';
  const stack   = error.stack   ?? '';
  const full    = `${message}\n${stack}`;

  for (const rule of CLASSIFICATION_RULES) {
    const msgMatch   = rule.patterns.some(p => p.test(full));
    const stackMatch = rule.stackPatterns?.some(p => p.test(stack)) ?? false;
    if (msgMatch || stackMatch) return rule.category;
  }

  // Default: if it timed out (status) but nothing matched patterns
  return 'Timing';
}

// ─── Report flattening ────────────────────────────────────────────────────────

interface FlatFailure {
  testName: string;
  suiteName: string;
  file: string;
  browser: string;
  results: PWResult[];
  status: PWTest['status'];
}

function flattenSuite(
  suite: PWSuite,
  suitePath: string[] = [],
): FlatFailure[] {
  const failures: FlatFailure[] = [];

  for (const spec of suite.specs) {
    for (const test of spec.tests) {
      const hasFailedResult = test.results.some(
        r => r.status === 'failed' || r.status === 'timedOut',
      );
      if (!hasFailedResult && test.status !== 'flaky') continue;

      failures.push({
        testName:  spec.title,
        suiteName: suitePath.concat(suite.title).filter(Boolean).join(' > '),
        file:      spec.file ?? suite.file ?? '',
        browser:   test.projectName,
        results:   test.results,
        status:    test.status,
      });
    }
  }

  for (const child of suite.suites ?? []) {
    failures.push(...flattenSuite(child, suitePath.concat(suite.title).filter(Boolean)));
  }

  return failures;
}

function classify(report: PWReport): ClassifiedFailure[] {
  const flat: FlatFailure[] = [];
  for (const suite of report.suites) {
    flat.push(...flattenSuite(suite));
  }

  // Group by (testName + file) to detect cross-browser failures
  const browserCountMap = new Map<string, Set<string>>();
  for (const f of flat) {
    const key = `${f.file}::${f.testName}`;
    if (!browserCountMap.has(key)) browserCountMap.set(key, new Set());
    browserCountMap.get(key)!.add(f.browser);
  }

  return flat.map(f => {
    const failedResult = f.results.find(
      r => r.status === 'failed' || r.status === 'timedOut',
    ) ?? f.results[0];

    const error = failedResult?.error ?? failedResult?.errors[0] ?? {};
    const category  = classifyError(error);
    const isFlaky   = f.status === 'flaky' ||
      (f.results.some(r => r.status === 'failed') &&
       f.results.some(r => r.status === 'passed'));
    const retryCount = f.results.filter(r => r.retry > 0).length;

    const key          = `${f.file}::${f.testName}`;
    const browserCount = browserCountMap.get(key)?.size ?? 1;

    const base = { category, isFlaky, retryCount };
    const severity = deriveSeverity(base, browserCount);

    const rootCause = buildRootCause(category, error, isFlaky, f.browser);

    return {
      testName:     f.testName,
      suiteName:    f.suiteName,
      file:         f.file,
      browser:      f.browser,
      category,
      severity,
      rootCause,
      violation:    VIOLATION_MAP[category] ?? null,
      fix:          FIX_TEMPLATE[category],
      errorMessage: (error.message ?? '').split('\n')[0].trim(),
      errorSnippet: error.snippet ?? null,
      isFlaky,
      retryCount,
      duration:     failedResult?.duration ?? 0,
    } satisfies ClassifiedFailure;
  });
}

function buildRootCause(
  category: FailureCategory,
  error: PWError,
  isFlaky: boolean,
  browser: string,
): string {
  const msg = error.message ?? '';

  switch (category) {
    case 'Selector': {
      const selectorMatch = msg.match(/locator\('([^']+)'\)/);
      const selector = selectorMatch ? `\`${selectorMatch[1]}\`` : 'the locator';
      return `${selector} could not be resolved in the DOM. ` +
        (isFlaky ? 'Intermittent — element may not have rendered in time. ' : '') +
        'Likely a DOM structure assumption or missing data-test attribute.';
    }
    case 'Timing': {
      const timeoutMatch = msg.match(/(\d+)ms/);
      const ms = timeoutMatch ? `${timeoutMatch[1]}ms` : 'the configured timeout';
      return `Assertion did not pass within ${ms}. ` +
        (browser === 'webkit' ? 'WebKit renders animations/transitions more strictly — ' : '') +
        'The UI state was not reached before Playwright stopped retrying.';
    }
    case 'State': {
      const expected = msg.match(/Expected:\s+"?([^\n"]+)"?/)?.[1];
      const received = msg.match(/Received:\s+"?([^\n"]+)"?/)?.[1];
      if (expected && received) {
        return `Expected \`${expected}\` but got \`${received}\`. ` +
          'UI state did not match expectation — page may not have finished updating.';
      }
      return 'UI was in an unexpected state when the assertion ran.';
    }
    case 'Network/API':
      return 'A network request failed or timed out before the test could assert. ' +
        'Common under performance_glitch_user or slow CI environments.';
    case 'Assertion':
      return 'The asserted value was wrong. ' +
        'Check whether the test data or expected value matches the current application state.';
    case 'TestDesign':
      return 'A code-level error (TypeError / undefined access) caused the test to crash. ' +
        'Usually caused by awaiting a locator, calling .isVisible() without retry, ' +
        'or a missing null guard.';
  }
}

// ─── Pattern summary ──────────────────────────────────────────────────────────

function buildSummary(failures: ClassifiedFailure[]): PatternSummary {
  const browserHits = new Map<string, number>();
  const summary: PatternSummary = {
    selector: 0, timing: 0, state: 0, networkApi: 0,
    assertion: 0, testDesign: 0, mostAffectedBrowser: 'N/A', flaky: 0,
  };

  for (const f of failures) {
    switch (f.category) {
      case 'Selector':    summary.selector++;   break;
      case 'Timing':      summary.timing++;     break;
      case 'State':       summary.state++;      break;
      case 'Network/API': summary.networkApi++; break;
      case 'Assertion':   summary.assertion++;  break;
      case 'TestDesign':  summary.testDesign++; break;
    }
    if (f.isFlaky) summary.flaky++;
    browserHits.set(f.browser, (browserHits.get(f.browser) ?? 0) + 1);
  }

  if (browserHits.size > 0) {
    summary.mostAffectedBrowser = [...browserHits.entries()]
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  return summary;
}

// ─── Systemic issue detection ──────────────────────────────────────────────────

interface SystemicIssue {
  description: string;
  affectedTests: string[];
  count: number;
}

function detectSystemicIssues(failures: ClassifiedFailure[]): SystemicIssue[] {
  const issues: SystemicIssue[] = [];

  // Cross-browser failures (same test, multiple browsers)
  const crossBrowserMap = new Map<string, string[]>();
  for (const f of failures) {
    const key = `${f.file}::${f.testName}`;
    if (!crossBrowserMap.has(key)) crossBrowserMap.set(key, []);
    crossBrowserMap.get(key)!.push(f.browser);
  }
  const crossBrowser = [...crossBrowserMap.entries()]
    .filter(([, browsers]) => browsers.length >= 2);
  if (crossBrowser.length > 0) {
    issues.push({
      description: 'Tests failing across multiple browsers — framework-level issue, not browser-specific',
      affectedTests: crossBrowser.map(([key]) => key.split('::')[1]),
      count: crossBrowser.length,
    });
  }

  // Repeated category
  const timingFailures = failures.filter(f => f.category === 'Timing');
  if (timingFailures.length >= 3) {
    issues.push({
      description: 'Timing issues across 3+ tests — Playwright retry model is not being used consistently. ' +
        'Replace `.textContent()` + `.toBe()` with `expect(locator).toHaveText()`.',
      affectedTests: [...new Set(timingFailures.map(f => f.testName))],
      count: timingFailures.length,
    });
  }

  const selectorFailures = failures.filter(f => f.category === 'Selector');
  if (selectorFailures.length >= 2) {
    issues.push({
      description: 'Multiple selector failures — locators are brittle. ' +
        'Audit all CSS selectors without data-test attributes.',
      affectedTests: [...new Set(selectorFailures.map(f => f.testName))],
      count: selectorFailures.length,
    });
  }

  const designFailures = failures.filter(f => f.category === 'TestDesign');
  if (designFailures.length >= 2) {
    issues.push({
      description: 'Multiple test design violations — QA contract anti-patterns active in codebase. ' +
        'Run `npm run validate:timeouts` and audit POM methods for `.isVisible()` usage.',
      affectedTests: [...new Set(designFailures.map(f => f.testName))],
      count: designFailures.length,
    });
  }

  const flakyTests = failures.filter(f => f.isFlaky);
  if (flakyTests.length > 0) {
    issues.push({
      description: `${flakyTests.length} flaky test(s) detected (passed on retry). ` +
        'Fix root cause — do not increase retries as a workaround.',
      affectedTests: [...new Set(flakyTests.map(f => f.testName))],
      count: flakyTests.length,
    });
  }

  return issues;
}

// ─── Recommended actions ──────────────────────────────────────────────────────

function buildActions(failures: ClassifiedFailure[], summary: PatternSummary): string[] {
  const actions: string[] = [];
  const ordered: Array<[number, string]> = [
    [summary.testDesign,  '🔴 Audit POM methods for `.isVisible()` / `setTimeout` — QA contract violations'],
    [summary.timing,      '🟠 Replace all `.textContent()` + `.toBe()` with `expect(locator).toHaveText()` — biggest stability gain'],
    [summary.selector,    '🟠 Replace brittle CSS selectors with `[data-test="…"]` or `getByRole()`'],
    [summary.state,       '🟡 Replace generic load-state waits with retried URL or locator assertions'],
    [summary.networkApi,  '🟡 Wrap API-dependent assertions with `page.waitForResponse()`'],
    [summary.assertion,   '🟢 Review expected values — ensure test data matches application state'],
  ];

  for (const [count, action] of ordered) {
    if (count > 0) actions.push(`${action} (${count} occurrence${count > 1 ? 's' : ''})`);
  }

  const flakyCount = failures.filter(f => f.isFlaky).length;
  if (flakyCount > 0) {
    actions.push(`🔴 Investigate ${flakyCount} flaky test${flakyCount > 1 ? 's' : ''} — fix root cause, never increase retries`);
  }

  return actions;
}

// ─── Markdown renderer ─────────────────────────────────────────────────────────

function severityIcon(s: Severity): string {
  return s.split(' ')[0];
}

function renderMarkdown(
  failures: ClassifiedFailure[],
  summary: PatternSummary,
  systemic: SystemicIssue[],
  actions: string[],
  inputFile: string,
): string {
  const lines: string[] = [];
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

  lines.push(`# 🔍 Playwright Failure Classification Report`);
  lines.push(`> Generated: ${timestamp}  `);
  lines.push(`> Source: \`${inputFile}\`  `);
  lines.push(`> Total failures classified: **${failures.length}**`);
  lines.push('');

  // ── Failed tests ────────────────────────────────────────────────────────────
  if (failures.length === 0) {
    lines.push('## ✅ No failures detected');
    lines.push('');
  } else {
    lines.push('## 🔴 Failed Tests Analysis');
    lines.push('');

    for (const f of failures) {
      lines.push(`### ${severityIcon(f.severity)} Test: \`${f.testName}\``);
      lines.push('');
      lines.push(`| Field | Value |`);
      lines.push(`|---|---|`);
      lines.push(`| **Suite** | ${f.suiteName || '—'} |`);
      lines.push(`| **File** | \`${f.file}\` |`);
      lines.push(`| **Browser** | ${f.browser} |`);
      lines.push(`| **Category** | ${f.category} |`);
      lines.push(`| **Severity** | ${f.severity} |`);
      lines.push(`| **Flaky** | ${f.isFlaky ? '⚠️ Yes (passed on retry)' : 'No'} |`);
      lines.push(`| **Duration** | ${(f.duration / 1000).toFixed(1)}s |`);
      lines.push('');
      lines.push(`**Root Cause:** ${f.rootCause}`);
      lines.push('');
      if (f.violation) {
        lines.push(`**Violation:** ${f.violation}`);
        lines.push('');
      }

      if (f.errorMessage) {
        lines.push('**Error:**');
        lines.push('```');
        lines.push(f.errorMessage);
        lines.push('```');
        lines.push('');
      }

      if (f.errorSnippet) {
        lines.push('**Code snippet:**');
        lines.push('```ts');
        lines.push(f.errorSnippet.trim());
        lines.push('```');
        lines.push('');
      }

      lines.push(`**Fix:** ${f.fix}`);
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  // ── Pattern summary ─────────────────────────────────────────────────────────
  lines.push('## 📊 Pattern Summary');
  lines.push('');
  lines.push('| Category | Count |');
  lines.push('|---|---|');
  lines.push(`| Selector issues | ${summary.selector} |`);
  lines.push(`| Timing issues | ${summary.timing} |`);
  lines.push(`| State issues | ${summary.state} |`);
  lines.push(`| Network/API issues | ${summary.networkApi} |`);
  lines.push(`| Assertion issues | ${summary.assertion} |`);
  lines.push(`| Test Design issues | ${summary.testDesign} |`);
  lines.push(`| Flaky tests (passed on retry) | ${summary.flaky} |`);
  lines.push('');
  lines.push(`**Most affected browser:** ${summary.mostAffectedBrowser}`);
  lines.push('');

  const highestRisk = failures
    .filter(f => f.severity === '🔴 Critical' || f.severity === '🟠 High')
    .map(f => f.browser);
  const riskBrowsers = [...new Set(highestRisk)];
  if (riskBrowsers.length > 0) {
    lines.push(`**Highest flake risk:** ${riskBrowsers.join(', ')}`);
    lines.push('');
  }

  // ── Systemic issues ─────────────────────────────────────────────────────────
  lines.push('## 🚨 Systemic Issues');
  lines.push('');
  if (systemic.length === 0) {
    lines.push('No systemic issues detected.');
  } else {
    systemic.forEach((issue, i) => {
      lines.push(`### ${i + 1}. ${issue.description}`);
      lines.push('');
      lines.push(`**Affected tests (${issue.count}):**`);
      for (const t of issue.affectedTests) {
        lines.push(`- \`${t}\``);
      }
      lines.push('');
    });
  }
  lines.push('');

  // ── Actions ─────────────────────────────────────────────────────────────────
  lines.push('## ✅ Recommended Actions (Priority Order)');
  lines.push('');
  actions.forEach((action, i) => {
    lines.push(`${i + 1}. ${action}`);
  });
  lines.push('');

  // ── Golden rule ─────────────────────────────────────────────────────────────
  lines.push('---');
  lines.push('');
  lines.push('> **Golden Rule:** A test is only good if it is **stable, readable, and trustworthy**');
  lines.push('> Every failure above reduces to one principle:');
  lines.push('> ❌ Tests checking state → ✅ Tests **waiting** for state via `await expect(locator).to…`');
  lines.push('');

  return lines.join('\n');
}

// ─── Entry point ──────────────────────────────────────────────────────────────

function run(): void {
  const args = process.argv.slice(2);
  const jsonFlag  = args.includes('--json');
  const outIndex  = args.indexOf('--out');
  const outFile   = outIndex !== -1 ? args[outIndex + 1] : null;

  const inputArg = args.find(a => !a.startsWith('--') && a !== outFile);
  const inputFile = inputArg
    ?? path.join(process.cwd(), 'playwright-report', 'results.json');

  if (!fs.existsSync(inputFile)) {
    console.error(`❌  Report not found: ${inputFile}`);
    console.error('');
    console.error('Run your tests first with the JSON reporter enabled:');
    console.error('  npx playwright test --reporter=json --reporter=list 2>&1 | tee results.json');
    console.error('  Or add json reporter to your playwright config, then pass the output file:');
    console.error('  npx ts-node utils/reporters/failure-classifier.ts results.json');
    process.exit(1);
  }

  let report: PWReport;
  try {
    report = JSON.parse(fs.readFileSync(inputFile, 'utf-8')) as PWReport;
  } catch {
    console.error(`❌  Failed to parse JSON: ${inputFile}`);
    process.exit(1);
  }

  const failures = classify(report);
  const summary  = buildSummary(failures);
  const systemic = detectSystemicIssues(failures);
  const actions  = buildActions(failures, summary);

  if (jsonFlag) {
    const output = JSON.stringify({ failures, summary, systemic, actions }, null, 2);
    if (outFile) {
      fs.writeFileSync(outFile, output, 'utf-8');
      console.log(`✅  JSON written to: ${outFile}`);
    } else {
      process.stdout.write(output);
    }
    return;
  }

  const markdown = renderMarkdown(failures, summary, systemic, actions, inputFile);

  if (outFile) {
    fs.writeFileSync(outFile, markdown, 'utf-8');
    console.log(`✅  Report written to: ${outFile}`);

    // Print terse console summary
    console.log('');
    console.log(`📊  ${failures.length} failure(s) classified`);
    console.log(`    Selector: ${summary.selector}  Timing: ${summary.timing}  State: ${summary.state}`);
    console.log(`    Network:  ${summary.networkApi}  Assertion: ${summary.assertion}  Design: ${summary.testDesign}`);
    if (summary.flaky > 0) console.log(`    ⚠️  Flaky: ${summary.flaky}`);
  } else {
    process.stdout.write(markdown);
  }
}

run();
