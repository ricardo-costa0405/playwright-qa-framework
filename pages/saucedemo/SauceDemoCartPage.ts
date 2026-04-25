import { expect } from '@playwright/test';
import { BasePage } from '../BasePage';

/**
 * Sauce Demo Cart Page — Page Object Model
 *
 * URL: /cart.html
 *
 * Covers:
 *  - Inspect cart contents (names, prices, quantities)
 *  - Remove individual items
 *  - Continue shopping (back to inventory)
 *  - Proceed to checkout
 */
export class SauceDemoCartPage extends BasePage {
  private readonly SELECTORS = {
    title:             '[data-test="title"]',
    cartList:          '[data-test="cart-list"]',
    cartItem:          '[data-test="inventory-item"]',
    itemName:          '[data-test="inventory-item-name"]',
    itemPrice:         '[data-test="inventory-item-price"]',
    itemQuantity:      '[data-test="item-quantity"]',
    continueShopping:  '[data-test="continue-shopping"]',
    checkoutButton:    '[data-test="checkout"]',
  } as const;

  protected getUrl(): string {
    return '/cart.html';
  }

  protected async verifyPageLoaded(): Promise<void> {
    await expect(this.page.locator(this.SELECTORS.title)).toHaveText('Your Cart');
  }

  // ─── Cart queries ────────────────────────────────────────────────────────

  async getCartItemCount(): Promise<number> {
    return this.page.locator(this.SELECTORS.cartItem).count();
  }

  async getCartItemNames(): Promise<string[]> {
    return this.page.locator(this.SELECTORS.itemName).allTextContents();
  }

  async getCartItemPrices(): Promise<number[]> {
    const texts = await this.page.locator(this.SELECTORS.itemPrice).allTextContents();
    return texts.map(t => parseFloat(t.replace('$', '')));
  }

  async getItemQuantity(itemName: string): Promise<number> {
    const item = this.page.locator(this.SELECTORS.cartItem).filter({ hasText: itemName });
    const qty = await item.locator(this.SELECTORS.itemQuantity).textContent();
    return parseInt(qty ?? '0', 10);
  }

  // ─── Cart actions ────────────────────────────────────────────────────────

  /** Remove a specific item by its name */
  async removeItem(itemName: string): Promise<void> {
    const item = this.page.locator(this.SELECTORS.cartItem).filter({ hasText: itemName });
    await expect(item).toBeVisible();
    await item.getByRole('button', { name: /remove/i }).click();
    // Verify the item is gone before returning
    await expect(
      this.page.locator(this.SELECTORS.cartItem).filter({ hasText: itemName })
    ).toHaveCount(0);
  }

  // ─── Navigation ──────────────────────────────────────────────────────────

  async continueShopping(): Promise<void> {
    await this.clickAndNavigate(this.SELECTORS.continueShopping, /inventory\.html/);
  }

  async proceedToCheckout(): Promise<void> {
    await this.clickAndNavigate(this.SELECTORS.checkoutButton, /checkout-step-one/);
  }
}
