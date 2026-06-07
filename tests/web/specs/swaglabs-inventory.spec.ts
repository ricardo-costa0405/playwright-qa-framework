import { test, expect } from '../../../fixtures/saucedemo-fixtures';

/**
 * Swag Labs — Inventory Feature Tests @inventory
 *
 * Covers:
 *   ✓ Page loads with all 6 products
 *   ✓ Sorting A→Z and Z→A (alphabetical)
 *   ✓ Sorting price low→high and high→low
 *   ✓ Cart badge updates when items are added/removed
 *   ✓ Multiple items can be added in one session
 *
 * Anti-patterns enforced → see utils/patterns/anti-patterns-guide.ts (AGENT_RULES)
 */

test.describe('Inventory Feature @inventory', () => {

  test('page loads with all 6 products', async ({ inventoryPage }) => {
    // ==================== ARRANGE ====================
    // inventoryPage fixture handles login + navigation

    // ==================== ACT ====================
    const count = await inventoryPage.getItemCount();

    // ==================== ASSERT ====================
    expect(count).toBe(6);
  });

  test('sort A→Z orders products alphabetically', async ({ inventoryPage }) => {
    // ==================== ARRANGE ====================
    // Default order may not be A→Z

    // ==================== ACT ====================
    await inventoryPage.sortBy('az');

    // ==================== ASSERT ====================
    const names = await inventoryPage.getItemNames();
    expect(names).toEqual([...names].sort());
  });

  test('sort Z→A reverses alphabetical order', async ({ inventoryPage }) => {
    // ==================== ARRANGE ====================
    await inventoryPage.sortBy('az'); // start from a known order

    // ==================== ACT ====================
    await inventoryPage.sortBy('za');

    // ==================== ASSERT ====================
    const names = await inventoryPage.getItemNames();
    expect(names).toEqual([...names].sort().reverse());
  });

  test('sort price low→high returns ascending prices', async ({ inventoryPage }) => {
    // ==================== ARRANGE ====================
    // inventoryPage fixture starts on the product listing

    // ==================== ACT ====================
    await inventoryPage.sortBy('lohi');

    // ==================== ASSERT ====================
    const prices = await inventoryPage.getItemPrices();
    const sorted  = [...prices].sort((a, b) => a - b);
    expect(prices).toEqual(sorted);
  });

  test('sort price high→low returns descending prices', async ({ inventoryPage }) => {
    // ==================== ARRANGE ====================
    // inventoryPage fixture starts on the product listing

    // ==================== ACT ====================
    await inventoryPage.sortBy('hilo');

    // ==================== ASSERT ====================
    const prices = await inventoryPage.getItemPrices();
    const sorted  = [...prices].sort((a, b) => b - a);
    expect(prices).toEqual(sorted);
  });

  test('cart badge increments when an item is added', async ({ inventoryPage }) => {
    // ==================== ARRANGE ====================
    const initialCount = await inventoryPage.getCartBadgeCount();
    expect(initialCount).toBe(0); // cart starts empty

    // ==================== ACT ====================
    await inventoryPage.addItemToCart('Sauce Labs Backpack');

    // ==================== ASSERT ====================
    const badgeCount = await inventoryPage.getCartBadgeCount();
    expect(badgeCount).toBe(1);
  });

  test('cart badge decrements when an item is removed', async ({ inventoryPage }) => {
    // ==================== ARRANGE ====================
    await inventoryPage.addItemToCart('Sauce Labs Backpack');
    expect(await inventoryPage.getCartBadgeCount()).toBe(1);

    // ==================== ACT ====================
    await inventoryPage.removeItemFromCart('Sauce Labs Backpack');

    // ==================== ASSERT ====================
    const badgeCount = await inventoryPage.getCartBadgeCount();
    expect(badgeCount).toBe(0);
  });

  test('adding multiple items reflects correct badge count', async ({ inventoryPage }) => {
    // ==================== ARRANGE ====================
    const items = ['Sauce Labs Backpack', 'Sauce Labs Bike Light', 'Sauce Labs Onesie'];

    // ==================== ACT ====================
    for (const item of items) {
      await inventoryPage.addItemToCart(item);
    }

    // ==================== ASSERT ====================
    const badgeCount = await inventoryPage.getCartBadgeCount();
    expect(badgeCount).toBe(items.length);
  });

});
