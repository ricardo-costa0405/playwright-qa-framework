import { expect } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Sauce Demo Login Page — Page Object Model
 *
 * Target: https://www.saucedemo.com
 *
 * Covers:
 *  - Standard login / logout
 *  - Locked-out user error
 *  - Empty form validation
 *
 * Anti-patterns enforced (see utils/patterns/anti-patterns-guide.ts):
 *  ✗ No waitForTimeout / sleep
 *  ✗ No XPath selectors
 *  ✗ No brittle nth-child selectors
 *  ✓ data-test attributes + semantic IDs only
 *  ✓ State-based waits via expect()
 */
export class SauceDemoLoginPage extends BasePage {
  private readonly SELECTORS = {
    username:     '[data-test="username"]',
    password:     '[data-test="password"]',
    loginButton:  '[data-test="login-button"]',
    errorMessage: '[data-test="error"]',
    errorButton:  '[data-test="error-button"]',
  } as const;

  protected getUrl(): string {
    return '/';
  }

  protected async verifyPageLoaded(): Promise<void> {
    await expect(this.page.locator(this.SELECTORS.loginButton)).toBeVisible();
  }

  /** Fill credentials and submit */
  async login(username: string, password: string): Promise<void> {
    await this.fillInput(this.SELECTORS.username, username);
    await this.fillInput(this.SELECTORS.password, password);
    await this.clickAndWait(this.SELECTORS.loginButton);
  }

  /** Returns error text if visible, empty string otherwise */
  async getErrorMessage(): Promise<string> {
    const error = this.page.locator(this.SELECTORS.errorMessage);
    try {
      await expect(error).toBeVisible();
      return (await error.textContent())?.trim() ?? '';
    } catch {
      return '';
    }
  }

  async hasError(): Promise<boolean> {
    return this.isElementVisible(this.SELECTORS.errorMessage);
  }

  /** Dismiss the visible error banner */
  async dismissError(): Promise<void> {
    await this.page.locator(this.SELECTORS.errorButton).click();
    await expect(this.page.locator(this.SELECTORS.errorMessage)).toBeHidden();
  }
}
