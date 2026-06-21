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
    await expect(this.sortDropdown).toBeVisible();
    await this.sortDropdown.selectOption(option);
    await expect(this.sortDropdown).toHaveValue(option);
  }

  /**
   * Sort for problem_user which has a known glitch: the dropdown selection
   * reverts to default ("az") immediately after selecting a different option.
   * This method selects the option and then asserts the revert happened.
   */
  async sortByExpectingGlitch(option: SortOption): Promise<void> {
    await expect(this.sortDropdown).toBeVisible();
    await this.sortDropdown.selectOption(option);
    // problem_user glitch: value reverts to "az"
    await expect(this.sortDropdown).toHaveValue('az');
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  async goToCart(): Promise<void> {
    await expect(this.cartLink).toBeVisible();
    await this.cartLink.click();
    await expect(this.page).toHaveURL(/cart\.html/);
  }

  async logout(): Promise<void> {
    await expect(this.burgerMenuButton).toBeVisible();
    await this.burgerMenuButton.click();
    await expect(this.logoutLink).toBeVisible();
    await this.logoutLink.click();
    await expect(this.page).toHaveURL(/saucedemo\.com\/?$/);
  }
}
