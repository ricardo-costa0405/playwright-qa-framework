import { expect } from '@playwright/test';
import { BasePage } from '../BasePage';

export interface CheckoutInfo {
  firstName:  string;
  lastName:   string;
  postalCode: string;
}

/**
 * Sauce Demo Checkout Page — covers all 3 steps + complete screen
 *
 *   Step 1 (/checkout-step-one.html)  — Customer info form
 *   Step 2 (/checkout-step-two.html)  — Order overview + totals
 *   Complete (/checkout-complete.html) — Confirmation
 *
 * Locator strategy (priority order):
 *  1. getByRole    — all buttons
 *  2. getByPlaceholder — form inputs (no <label> elements, only placeholders)
 *     Note: "Cancel" button accessible name is "Go back Cancel" (composite
 *     from img alt + text). Playwright substring-matches by default.
 *  3. data-test fallback — only where no accessible anchor exists:
 *     · errorBanner  — container div, no role/accessible name
 *     · summary labels (itemTotal, tax, total) — plain text nodes, no role
 */
export class SauceDemoCheckoutPage extends BasePage {
  // ─── Step 1 locators ──────────────────────────────────────────────────────
  readonly firstNameInput = this.page.getByPlaceholder('First Name');
  readonly lastNameInput  = this.page.getByPlaceholder('Last Name');
  readonly postalCodeInput = this.page.getByPlaceholder('Zip/Postal Code');
  readonly continueButton = this.page.getByRole('button', { name: 'Continue' });
  // Composite accessible name "Go back Cancel" — substring match ✓
  readonly cancelButton   = this.page.getByRole('button', { name: 'Cancel' });

  // Error container has no role/accessible name → data-test fallback
  readonly errorBanner    = this.page.locator('[data-test="error"]');

  // ─── Step 2 locators ──────────────────────────────────────────────────────
  readonly finishButton   = this.page.getByRole('button', { name: 'Finish' });

  // Plain text nodes with no role → data-test fallback
  readonly itemTotalLabel = this.page.locator('[data-test="subtotal-label"]');
  readonly taxLabel       = this.page.locator('[data-test="tax-label"]');
  readonly totalLabel     = this.page.locator('[data-test="total-label"]');

  // ─── Complete screen locators ─────────────────────────────────────────────
  readonly completeHeading = this.page.getByRole('heading', { name: 'Thank you for your order!' });
  readonly backHomeButton  = this.page.getByRole('button', { name: 'Back Home' });

  protected getUrl(): string {
    return '/checkout-step-one.html';
  }

  protected async verifyPageLoaded(): Promise<void> {
    await expect(this.firstNameInput).toBeVisible();
  }

  // ─── Step 1: Customer info ─────────────────────────────────────────────────

  async fillInfo(info: CheckoutInfo): Promise<void> {
    await this.firstNameInput.fill(info.firstName);
    await this.lastNameInput.fill(info.lastName);
    await this.postalCodeInput.fill(info.postalCode);
  }

  async continueToOverview(): Promise<void> {
    await expect(this.continueButton).toBeVisible();
    await this.continueButton.click();
  }

  async cancelCheckout(): Promise<void> {
    await expect(this.cancelButton).toBeVisible();
    await this.cancelButton.click();
    await expect(this.page).toHaveURL(/cart\.html/);
  }

  async hasError(): Promise<boolean> {
    return this.errorBanner.isVisible();
  }

  async getErrorMessage(): Promise<string> {
    if (!await this.errorBanner.isVisible()) return '';
    return (await this.errorBanner.textContent())?.trim() ?? '';
  }

  // ─── Step 2: Overview ─────────────────────────────────────────────────────

  async getItemTotal(): Promise<string> {
    return (await this.itemTotalLabel.textContent())?.trim() ?? '';
  }

  async getTax(): Promise<string> {
    return (await this.taxLabel.textContent())?.trim() ?? '';
  }

  async getTotal(): Promise<string> {
    return (await this.totalLabel.textContent())?.trim() ?? '';
  }

  async finishOrder(): Promise<void> {
    await expect(this.finishButton).toBeVisible();
    await this.finishButton.click();
    await expect(this.page).toHaveURL(/checkout-complete/);
  }

  // ─── Complete screen ──────────────────────────────────────────────────────

  async isOrderComplete(): Promise<boolean> {
    return this.completeHeading.isVisible();
  }

  async getCompleteHeader(): Promise<string> {
    return (await this.completeHeading.textContent())?.trim() ?? '';
  }

  async backToProducts(): Promise<void> {
    await expect(this.backHomeButton).toBeVisible();
    await this.backHomeButton.click();
    await expect(this.page).toHaveURL(/inventory\.html/);
  }
}
