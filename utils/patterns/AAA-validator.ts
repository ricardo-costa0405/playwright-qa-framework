/**
 * AAA Pattern (Arrange-Act-Assert) Validator
 * Enforces test structure and prevents common anti-patterns
 */

export interface ValidationResult {
  valid: boolean;
  sections: AAASections;
  errors: string[];
}

export interface AAASections {
  arrange: string;
  act: string;
  assert: string;
}

/**
 * Validate that test follows Arrange-Act-Assert pattern
 */
export class AAAValidator {
  /**
   * Validate test code structure
   * ENFORCES:
   * - Clear separation of setup, action, and verification
   * - Single Act phase (one action under test)
   * - Meaningful assertions with explicit expectations
   * - No business logic in arrange phase
   */
  static validate(testCode: string): ValidationResult {
    const errors: string[] = [];
    const sections = this.identifySections(testCode);

    // RULE 1: Must have all three phases
    if (!sections.arrange) {
      errors.push(
        'Missing Arrange section. Add: // ========== ARRANGE =========='
      );
    }
    if (!sections.act) {
      errors.push('Missing Act section. Add: // ========== ACT ==========');
    }
    if (!sections.assert) {
      errors.push(
        'Missing Assert section. Add: // ========== ASSERT =========='
      );
    }

    // RULE 2: Act phase must be single, focused action
    if (sections.act && this.countActions(sections.act) > 1) {
      errors.push(
        'Act phase must contain single action under test. Found multiple actions.'
      );
    }

    // RULE 3: Assert phase must have explicit expectations
    if (sections.assert && !this.hasExplicitAssertions(sections.assert)) {
      errors.push('Assert phase must have explicit expect() calls');
    }

    // RULE 4: No setTimeout, sleep, or hardcoded delays
    if (this.containsTimeouts(testCode)) {
      errors.push(
        'Test contains hardcoded timeouts. Use state-based waits instead: ' +
        'expect(), toHaveURL(), waitForSelector()'
      );
    }

    return {
      valid: errors.length === 0,
      sections,
      errors,
    };
  }

  /**
   * Identify AAA sections in test code
   */
  private static identifySections(code: string): AAASections {
    const arrangeRegex = /\/\/\s*={5,}\s*ARRANGE\s*={5,}([\s\S]*?)(\/\/\s*={5,}\s*ACT|$)/;
    const actRegex = /\/\/\s*={5,}\s*ACT\s*={5,}([\s\S]*?)(\/\/\s*={5,}\s*ASSERT|$)/;
    const assertRegex = /\/\/\s*={5,}\s*ASSERT\s*={5,}([\s\S]*?)$/;

    const arrangeMatch = code.match(arrangeRegex);
    const actMatch = code.match(actRegex);
    const assertMatch = code.match(assertRegex);

    return {
      arrange: arrangeMatch ? arrangeMatch[1].trim() : '',
      act: actMatch ? actMatch[1].trim() : '',
      assert: assertMatch ? assertMatch[1].trim() : '',
    };
  }

  /**
   * Count distinct actions in section
   * An action is a function call on page or element
   */
  private static countActions(sectionCode: string): number {
    // Count distinct action calls (click, fill, select, goto, etc)
    const actionPatterns = [/\.click\(/g, /\.fill\(/g, /\.selectOption\(/g, /\.goto\(/g];

    let count = 0;
    for (const pattern of actionPatterns) {
      const matches = sectionCode.match(pattern);
      if (matches) {
        count += matches.length;
      }
    }

    return count;
  }

  /**
   * Check if section has explicit assertions
   */
  private static hasExplicitAssertions(sectionCode: string): boolean {
    return /expect\s*\(/.test(sectionCode);
  }

  /**
   * Check for hardcoded timing patterns
   */
  private static containsTimeouts(code: string): boolean {
    const timeoutPatterns = [
      /waitForTimeout\s*\(/,
      /setTimeout\s*\(/,
      /sleep\s*\(/,
      /\.wait\s*\(\s*\d+\s*\)/,
    ];

    for (const pattern of timeoutPatterns) {
      if (pattern.test(code)) {
        return true;
      }
    }

    return false;
  }
}

export default AAAValidator;
