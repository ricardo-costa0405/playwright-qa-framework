/**
 * Timeout Scanner - Validates zero hardcoded timeouts policy
 *
 * This script scans all test files and reports any usage of:
 * - waitForTimeout()
 * - setTimeout()
 * - sleep()
 * - page.wait(milliseconds)
 * - hardcoded millisecond waits
 *
 * Exit Code: 0 if no violations, 1 if violations found
 */

import fs from 'fs';
import path from 'path';

const BANNED_PATTERNS = [
  /\bwaitForTimeout\s*\(/,           // waitForTimeout(ms)
  /\bsetTimeout\s*\(/,                // setTimeout(fn, ms)
  /\bsleep\s*\(/,                     // sleep(ms)
  /\bpage\.wait\s*\(\s*\d+\s*\)/,    // page.wait(5000)
  /\bcontext\.waitForTimeout\s*\(/, // context.waitForTimeout(ms)
  /await\s+page\.waitForTimeout/,    // await page.waitForTimeout()
];

const TEST_DIRS = [
  'tests/web/specs',
  'tests/api/specs',
  'tests/mobile-web/specs',
];

interface Violation {
  file: string;
  line: number;
  content: string;
  pattern: string;
}

function scanFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      BANNED_PATTERNS.forEach((pattern) => {
        if (pattern.test(line)) {
          violations.push({
            file: filePath,
            line: index + 1,
            content: line.trim(),
            pattern: pattern.source,
          });
        }
      });
    });
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
  }

  return violations;
}

function scanDirectory(dir: string): Violation[] {
  const violations: Violation[] = [];

  if (!fs.existsSync(dir)) {
    console.warn(`Directory not found: ${dir}`);
    return violations;
  }

  const files = fs.readdirSync(dir, { recursive: true });

  files.forEach((file) => {
    if (typeof file === 'string' && file.endsWith('.ts')) {
      const filePath = path.join(dir, file);
      violations.push(...scanFile(filePath));
    }
  });

  return violations;
}

// Main execution
console.log('🔍 Scanning for hardcoded timeouts...\n');

let totalViolations: Violation[] = [];

TEST_DIRS.forEach((dir) => {
  const violations = scanDirectory(dir);
  totalViolations.push(...violations);
});

if (totalViolations.length === 0) {
  console.log('✅ No hardcoded timeouts found!\n');
  console.log('Approved timeout patterns used:');
  console.log('  • expect(element).toBeVisible({ timeout: 10000 })');
  console.log('  • expect(page).toHaveURL(/expected-path/)');
  console.log('  • page.waitForFunction(...)');
  console.log('  • AntiTimeoutGuard.waitStrategies.*()');
  process.exit(0);
} else {
  console.error(`❌ Found ${totalViolations.length} banned timeout pattern(s):\n`);

  const groupedByFile = totalViolations.reduce(
    (acc, violation) => {
      if (!acc[violation.file]) {
        acc[violation.file] = [];
      }
      acc[violation.file].push(violation);
      return acc;
    },
    {} as Record<string, Violation[]>
  );

  Object.entries(groupedByFile).forEach(([file, violations]) => {
    console.error(`\n📄 ${file}`);
    violations.forEach((v) => {
      console.error(`   Line ${v.line}: ${v.content}`);
      console.error(`   Pattern: ${v.pattern}\n`);
    });
  });

  process.exit(1);
}
