import { expect } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Sauce Demo Login Page
 *
 * Locator strategy (priority order):
 *  1. getByRole       — reflects user + screen reader interaction
 *  2. getByPlaceholder — inputs have no <label>, only placeholders
 *  3. data-test fallback — only where no accessible anchor exists:
 *     · errorBanner   — container div has no role or accessible name
 *     · dismissButton — icon-only ✕ button with no accessible name
 */
export class SauceDemoLoginPage extends BasePage {
  // ─── Locators ─────────────────────────────────────────────────────────────
  readonly usernameInput = this.page.getByPlaceholder('Username');
  readonly passwordInput = this.page.getByPlaceholder('Password');
  readonly loginButton   = this.page.getByRole('button', { name: 'Login' });

  // Container div has no role/accessible name → data-test fallback
  readonly errorBanner   = this.page.locator('[data-test="error"]');
  // Icon-only ✕ button has no accessible name → data-test fallback
  readonly dismissButton = this.page.locator('[data-test="error-button"]');

  protected getUrl(): string {
    return '/';
  }

  protected async verifyPageLoaded(): Promise<void> {
    await expect(this.loginButton).toBeVisible();
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  async login(username: string, password: string): Promise<void> {
    await this.fillInput(this.SELECTORS.username, username);
    await this.fillInput(this.SELECTORS.password, password);
    await this.clickAndWait(this.SELECTORS.loginButton);
  }

  async getErrorMessage(): Promise<string> {
    if (!await this.errorBanner.isVisible()) return '';
    return (await this.errorBanner.textContent())?.trim() ?? '';
  }

  async hasError(): Promise<boolean> {
    return this.errorBanner.isVisible();
  }

  async dismissError(): Promise<void> {
    await this.dismissButton.click();
    await expect(this.errorBanner).toBeHidden();
  }
}
