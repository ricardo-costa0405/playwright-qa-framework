import { expect } from '@playwright/test';
import { BasePage } from '../BasePage';

export interface CheckoutInfo {
  firstName: string;
  lastName:  string;
  postalCode: string;
}

/**
 * Sauce Demo Checkout Page — Page Object Model
 *
 * Covers 3 sequential steps:
 *
 *   Step 1 (/checkout-step-one.html)  — Customer info form
 *   Step 2 (/checkout-step-two.html)  — Order overview + totals
 *   Complete (/checkout-complete.html) — Confirmation
 *
 * Each step is handled by dedicated methods; the POM follows the user
 * through the entire flow without the test knowing about URLs.
 */
export class SauceDemoCheckoutPage extends BasePage {
  private readonly SELECTORS = {
    // Step 1
    title:          '[data-test="title"]',
    firstName:      '[data-test="firstName"]',
    lastName:       '[data-test="lastName"]',
    postalCode:     '[data-test="postalCode"]',
    continueButton: '[data-test="continue"]',
    cancelButton:   '[data-test="cancel"]',
    errorMessage:   '[data-test="error"]',

    // Step 2
    itemTotal:      '[data-test="subtotal-label"]',
    taxLabel:       '[data-test="tax-label"]',
    totalLabel:     '[data-test="total-label"]',
    finishButton:   '[data-test="finish"]',

    // Complete
    completeHeader: '[data-test="complete-header"]',
    completeText:   '[data-test="complete-text"]',
    backHomeButton: '[data-test="back-to-products"]',
  } as const;

  protected getUrl(): string {
    return '/checkout-step-one.html';
  }

  protected async verifyPageLoaded(): Promise<void> {
    await expect(this.page.locator(this.SELECTORS.firstName)).toBeVisible();
  }

  // ─── Step 1: Customer Info ────────────────────────────────────────────────

  async fillInfo(info: CheckoutInfo): Promise<void> {
    await this.fillInput(this.SELECTORS.firstName, info.firstName);
    await this.fillInput(this.SELECTORS.lastName, info.lastName);
    await this.fillInput(this.SELECTORS.postalCode, info.postalCode);
  }

  async continueToOverview(): Promise<void> {
    await this.clickAndWait(this.SELECTORS.continueButton);
  }

  async cancelCheckout(): Promise<void> {
    await this.clickAndNavigate(this.SELECTORS.cancelButton, /cart\.html/);
  }

  async hasError(): Promise<boolean> {
    return this.isElementVisible(this.SELECTORS.errorMessage);
  }

  async getErrorMessage(): Promise<string> {
    return this.getText(this.SELECTORS.errorMessage);
  }

  // ─── Step 2: Overview ────────────────────────────────────────────────────

  async getItemTotal(): Promise<string> {
    return this.getText(this.SELECTORS.itemTotal);
  }

  async getTax(): Promise<string> {
    return this.getText(this.SELECTORS.taxLabel);
  }

  async getTotal(): Promise<string> {
    return this.getText(this.SELECTORS.totalLabel);
  }

  async finishOrder(): Promise<void> {
    await this.clickAndNavigate(this.SELECTORS.finishButton, /checkout-complete/);
  }

  // ─── Complete ────────────────────────────────────────────────────────────

  async isOrderComplete(): Promise<boolean> {
    return this.isElementVisible(this.SELECTORS.completeHeader);
  }

  async getCompleteHeader(): Promise<string> {
    return this.getText(this.SELECTORS.completeHeader);
  }

  async getCompleteText(): Promise<string> {
    return this.getText(this.SELECTORS.completeText);
  }

  async backToProducts(): Promise<void> {
    await this.clickAndNavigate(this.SELECTORS.backHomeButton, /inventory\.html/);
  }
}
