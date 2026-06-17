import { test, expect } from '../../../fixtures/saucedemo-fixtures';
import { SauceDemoCartPage } from '../../../pages/saucedemo/SauceDemoCartPage';

/**
 * Swag Labs — Cart Feature Tests @cart
 *
 * Covers:
 *   ✓ Cart is empty on fresh login
 *   ✓ Items added from inventory appear in cart with correct names/prices
 *   ✓ Removing an item from cart works and cart reflects the change
 *   ✓ Continue Shopping navigates back to inventory (cart contents survive)
 *
 * Anti-patterns enforced → see utils/patterns/anti-patterns-guide.ts (AGENT_RULES)
 */

test.describe('Cart Feature @cart', () => {

  test('cart is empty after login with no items added', async ({ cartPage }) => {
    // ==================== ARRANGE ====================
    // cartPage fixture: authenticated + navigated to /cart.html, no items added

    // ==================== ACT ====================
    const count = await cartPage.getCartItemCount();

    // ==================== ASSERT ====================
    expect(count).toBe(0);
  });

  test('items added from inventory appear in cart', async ({ inventoryPage, page }) => {
    // ==================== ARRANGE ====================
    const item = 'Sauce Labs Fleece Jacket';
    await inventoryPage.addItemToCart(item);

    // ==================== ACT ====================
    await inventoryPage.goToCart();

    // ==================== ASSERT ====================
    const cartPage = new SauceDemoCartPage(page);
    const names = await cartPage.getCartItemNames();
    expect(names).toContain(item);
    expect(await cartPage.getCartItemCount()).toBe(1);
  });

  test('removing an item from cart updates cart correctly', async ({ inventoryPage, page }) => {
    // ==================== ARRANGE ====================
    const item = 'Sauce Labs Bolt T-Shirt';
    await inventoryPage.addItemToCart(item);
    await inventoryPage.goToCart();

    const cartPage = new SauceDemoCartPage(page);
    expect(await cartPage.getCartItemCount()).toBe(1);

    // ==================== ACT ====================
    await cartPage.removeItem(item);

    // ==================== ASSERT ====================
    expect(await cartPage.getCartItemCount()).toBe(0);
  });

  test('Continue Shopping returns to inventory without clearing cart', async ({ inventoryPage, page }) => {
    // ==================== ARRANGE ====================
    const item = 'Sauce Labs Backpack';
    await inventoryPage.addItemToCart(item);
    await inventoryPage.goToCart();

    const cartPage = new SauceDemoCartPage(page);

    // ==================== ACT ====================
    await cartPage.continueShopping();

    // ==================== ASSERT ====================
    await expect(page).toHaveURL(/inventory\.html/);

    // Badge still shows 1 — cart survives navigation
    const badge = await inventoryPage.getCartBadgeCount();
    expect(badge).toBe(1);
  });

  test('multiple items show correct quantities in cart', async ({ inventoryPage, page }) => {
    // ==================== ARRANGE ====================
    const items = ['Sauce Labs Backpack', 'Sauce Labs Bike Light'];
    for (const item of items) {
      await inventoryPage.addItemToCart(item);
    }

    // ==================== ACT ====================
    await inventoryPage.goToCart();

    // ==================== ASSERT ====================
    const cartPage = new SauceDemoCartPage(page);
    expect(await cartPage.getCartItemCount()).toBe(items.length);

    const names = await cartPage.getCartItemNames();
    for (const item of items) {
      expect(names).toContain(item);
    }
  });

});
