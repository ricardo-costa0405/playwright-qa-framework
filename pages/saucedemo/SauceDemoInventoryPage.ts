import { expect } from '@playwright/test';
import { BasePage } from '../BasePage';

export type SortOption = 'az' | 'za' | 'lohi' | 'hilo';

/**
 * Sauce Demo Inventory Page
 *
 * Locator strategy (priority order):
 *  1. getByRole  — burger menu, close menu, logout link
 *  2. getByRole (combobox) — sort dropdown has no label, only role
 *  3. data-test fallback — only where no accessible anchor exists:
 *     · cartLink  — shopping cart icon link has no accessible name
 *     · cartBadge — raw number badge, no accessible name
 *     · inventoryItem — container div, no semantic role
 *     · itemName/itemPrice — used for bulk text extraction only
 */
export class SauceDemoInventoryPage extends BasePage {
  // ─── Locators ─────────────────────────────────────────────────────────────

  // Burger menu
  readonly burgerMenuButton = this.page.getByRole('button', { name: 'Open Menu' });
  readonly closeMenuButton  = this.page.getByRole('button', { name: 'Close Menu' });
  readonly logoutLink       = this.page.getByRole('link',   { name: 'Logout' });

  // Sort — only combobox on page; unlabelled in DOM → getByRole is best option
  readonly sortDropdown = this.page.getByRole('combobox');

  // Cart icon has no accessible name → data-test fallback
  readonly cartLink  = this.page.locator('[data-test="shopping-cart-link"]');
  // Badge is a plain number with no accessible name → data-test fallback
  readonly cartBadge = this.page.locator('[data-test="shopping-cart-badge"]');

  // Container divs — no semantic role; used as filter scope only
  private readonly inventoryItem  = this.page.locator('[data-test="inventory-item"]');
  private readonly itemNameText   = this.page.locator('[data-test="inventory-item-name"]');
  private readonly itemPriceText  = this.page.locator('[data-test="inventory-item-price"]');

  protected getUrl(): string {
    return '/inventory.html';
  }

  protected async verifyPageLoaded(): Promise<void> {
    await expect(this.page.locator('[data-test="inventory-container"]')).toBeVisible();
    await expect(this.page.locator('[data-test="title"]')).toHaveText('Products');
  }

  // ─── Inventory queries ────────────────────────────────────────────────────

  async getItemCount(): Promise<number> {
    return this.inventoryItem.count();
  }

  async getItemNames(): Promise<string[]> {
    return this.itemNameText.allTextContents();
  }

  async getItemPrices(): Promise<number[]> {
    const texts = await this.itemPriceText.allTextContents();
    return texts.map((t) => parseFloat(t.replace('$', '')));
  }

  // ─── Cart actions ─────────────────────────────────────────────────────────

  /** Scoped to the item container — resolves ambiguity when multiple items shown */
  async addItemToCart(itemName: string): Promise<void> {
    const item = this.inventoryItem.filter({ hasText: itemName });
    await expect(item).toBeVisible();
    await item.getByRole('button', { name: 'Add to cart' }).click();
  }

  async removeItemFromCart(itemName: string): Promise<void> {
    const item = this.inventoryItem.filter({ hasText: itemName });
    await expect(item).toBeVisible();
    await item.getByRole('button', { name: 'Remove' }).click();
  }

  async getCartBadgeCount(): Promise<number> {
    if (await this.cartBadge.count() === 0) return 0;
    if (!await this.cartBadge.isVisible()) return 0;
    return parseInt((await this.cartBadge.textContent()) ?? '0', 10);
  }

  // ─── Sorting ──────────────────────────────────────────────────────────────

  async sortBy(option: SortOption): Promise<void> {
    const dropdown = this.page.locator(this.SELECTORS.sortDropdown);
    await expect(dropdown).toBeVisible();
    await dropdown.selectOption(option);
    await expect(dropdown).toHaveValue(option);
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  async goToCart(): Promise<void> {
    await this.clickAndNavigate(this.SELECTORS.cartLink, /cart\.html/);
  }

  async logout(): Promise<void> {
    await this.clickAndExpectVisible(this.SELECTORS.burgerMenu, this.SELECTORS.logoutLink);
    await this.clickAndNavigate(this.SELECTORS.logoutLink, /saucedemo\.com\/?$/);
  }
}
