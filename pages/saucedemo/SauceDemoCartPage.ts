import { expect } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Sauce Demo Cart Page
 *
 * Locator strategy (priority order):
 *  1. getByRole — Checkout and Continue Shopping buttons
 *     Note: "Continue Shopping" button accessible name is "Go back Continue Shopping"
 *     (composite from img alt + text). Playwright substring-matches by default.
 *  2. data-test fallback — only where no accessible anchor exists:
 *     · cartItem     — container div, no semantic role
 *     · itemName/Price/Qty — used for bulk text extraction only
 */
export class SauceDemoCartPage extends BasePage {
  // ─── Locators ─────────────────────────────────────────────────────────────

  // Composite accessible name "Go back Continue Shopping" — substring match ✓
  readonly continueShoppingButton = this.page.getByRole('button', { name: 'Continue Shopping' });
  readonly checkoutButton         = this.page.getByRole('button', { name: 'Checkout' });

  // Container divs — no semantic role; used as filter scope only
  private readonly cartItem     = this.page.locator('[data-test="inventory-item"]');
  private readonly itemNameText = this.page.locator('[data-test="inventory-item-name"]');
  private readonly itemPrice    = this.page.locator('[data-test="inventory-item-price"]');

  protected getUrl(): string {
    return '/cart.html';
  }

  protected async verifyPageLoaded(): Promise<void> {
    await expect(this.page.locator('[data-test="title"]')).toHaveText('Your Cart');
  }

  // ─── Cart queries ─────────────────────────────────────────────────────────

  async getCartItemCount(): Promise<number> {
    return this.cartItem.count();
  }

  async getCartItemNames(): Promise<string[]> {
    return this.itemNameText.allTextContents();
  }

  async getCartItemPrices(): Promise<number[]> {
    const texts = await this.itemPrice.allTextContents();
    return texts.map((t) => parseFloat(t.replace('$', '')));
  }

  async getItemQuantity(itemName: string): Promise<number> {
    const item = this.cartItem.filter({ hasText: itemName });
    const qty = await item.locator('[data-test="item-quantity"]').textContent();
    return parseInt(qty ?? '0', 10);
  }

  // ─── Cart actions ─────────────────────────────────────────────────────────

  async removeItem(itemName: string): Promise<void> {
    const item = this.cartItem.filter({ hasText: itemName });
    await expect(item).toBeVisible();
    await item.getByRole('button', { name: 'Remove' }).click();
    await expect(this.cartItem.filter({ hasText: itemName })).toHaveCount(0);
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  async continueShopping(): Promise<void> {
    await this.clickAndNavigate(this.SELECTORS.continueShopping, /inventory\.html/);
  }

  async proceedToCheckout(): Promise<void> {
    await this.clickAndNavigate(this.SELECTORS.checkoutButton, /checkout-step-one/);
  }
}
