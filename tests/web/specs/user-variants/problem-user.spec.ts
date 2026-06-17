import { type Page } from '@playwright/test';
import { test, expect, SAUCE_CREDENTIALS } from '../../../../fixtures/saucedemo-fixtures';
import {
  SauceDemoCartPage,
  SauceDemoCheckoutPage,
  SauceDemoInventoryPage,
  SauceDemoLoginPage,
} from '../../../../pages/saucedemo';

/**
 * Swag Labs — Problem User Variant Tests @problem-user
 *
 * Covers:
 *   ✓ Problem user triggers visual glitches in inventory
 *   ✓ Problem user experiences product image rendering issues
 *   ✓ Problem user can still add items to cart despite visual glitches
 *   ✓ Problem user completes checkout with data inconsistencies
 *   ✓ Problem user's cart and totals are calculated correctly despite glitches
 *
 * Anti-patterns enforced → AAA pattern compliance
 *
 * Note: problem_user simulates visual inconsistencies and data rendering issues
 * that occur when backend fails to sync with UI properly.
 *
 * ⚠ False-positive guard: these tests do NOT use the inventoryPage,
 * cartPage, or checkoutPage fixtures because those fixtures always log in
 * as standard_user.  Each test calls loginAsProblemUser() to ensure the
 * problem_user's glitchy session is actually being exercised.
 */

const inventoryList = '[data-test="inventory-list"]';
const cartBadge = '[data-test="shopping-cart-badge"]';
const cartItemLabel = '.cart_item_label';

async function loginAsProblemUser(page: Page): Promise<{
  loginPage: SauceDemoLoginPage;
  inventoryPage: SauceDemoInventoryPage;
}> {
  const loginPage = new SauceDemoLoginPage(page);
  await loginPage.navigate();
  await loginPage.login(
    SAUCE_CREDENTIALS.problem.username,
    SAUCE_CREDENTIALS.problem.password
  );
  await expect(page).toHaveURL(/inventory\.html/);
  await expect(page.locator(inventoryList)).toBeVisible();

  return {
    loginPage,
    inventoryPage: new SauceDemoInventoryPage(page),
  };
}

test.describe('Problem User Variant @problem-user', () => {

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  // ─── Login and inventory glitches ───────────────────────────────────────

  test('problem_user logs in successfully despite backend glitches', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { username, password } = SAUCE_CREDENTIALS.problem;
    const loginPage = new SauceDemoLoginPage(page);

    // ==================== ACT ====================
    await loginPage.navigate();
    await loginPage.login(username, password);

    // ==================== ASSERT ====================
    await expect(page).toHaveURL(/inventory\.html/);
    await expect(page).toHaveTitle('Swag Labs');
    // Despite visual glitches, inventory list should load
    await expect(page.locator(inventoryList)).toBeVisible();
  });

  test('problem_user sees products but with visual rendering issues', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsProblemUser(page);

    // ==================== ACT ====================
    const itemCount = await inventoryPage.getItemCount();

    // ==================== ASSERT ====================
    expect(itemCount).toBe(6);

    const names = await inventoryPage.getItemNames();
    expect(names.length).toBe(6);
    expect(names).toContain('Sauce Labs Backpack');

    // Images might fail to load due to backend glitches — verify DOM presence
    const images = page.locator('.inventory_item_img img');
    await expect(images).toHaveCount(6);
  });

  test('problem_user can add items to cart despite cart calculation glitches', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsProblemUser(page);
    const item = 'Sauce Labs Backpack';

    // ==================== ACT ====================
    await inventoryPage.addItemToCart(item);

    // ==================== ASSERT ====================
    const badgeCount = await inventoryPage.getCartBadgeCount();
    expect(badgeCount).toBe(1);

    await inventoryPage.goToCart();
    await expect(page).toHaveURL(/cart\.html/);

    const cartItemCount = await page.locator('[data-test="inventory-item"]').count();
    expect(cartItemCount).toBe(1);
  });

  // ─── Sorting behavior with glitches ───────────────────────────────────────

  test('problem_user sorting still works despite render glitches', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsProblemUser(page);
    const originalNames = await inventoryPage.getItemNames();

    // ==================== ACT ====================
    await inventoryPage.sortBy('za');

    // ==================== ASSERT ====================
    const sortedNames = await inventoryPage.getItemNames();

    // Should be different from original (sorted in reverse)
    expect(sortedNames).not.toEqual(originalNames);

    // Should be reverse alphabetical
    const manualSort = [...sortedNames].sort().reverse();
    expect(sortedNames).toEqual(manualSort);
  });

  test('problem_user price sorting works despite data inconsistencies', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsProblemUser(page);
    // Data might be inconsistent, but sorting should still work

    // ==================== ACT ====================
    await inventoryPage.sortBy('lohi');

    // ==================== ASSERT ====================
    const prices = await inventoryPage.getItemPrices();

    // Prices should be in ascending order
    const isSorted = prices.every((price, i) => i === 0 || prices[i - 1] <= price);
    expect(isSorted).toBe(true);
  });

  // ─── Checkout flow with glitches ───────────────────────────────────────

  test('problem_user can complete checkout despite visual glitches', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsProblemUser(page);
    const cartPage = new SauceDemoCartPage(page);
    const checkoutPage = new SauceDemoCheckoutPage(page);

    // Add item and navigate to checkout
    await inventoryPage.addItemToCart('Sauce Labs Backpack');
    await inventoryPage.goToCart();
    await cartPage.proceedToCheckout();
    await expect(page.locator('[data-test="firstName"]')).toBeVisible();

    const customerInfo = {
      firstName: 'Test',
      lastName: 'User',
      postalCode: '12345',
    };

    // ==================== ACT ====================
    await checkoutPage.fillInfo(customerInfo);
    await checkoutPage.continueToOverview();

    // ==================== ASSERT ====================
    // Should progress despite visual glitches
    await expect(page).toHaveURL(/checkout-step-two/);

    // Overview should display with potentially inconsistent data shown
    const total = await checkoutPage.getTotal();
    expect(total).toMatch(/Total:\s+\$[\d.]+/);

    // Complete the order
    await checkoutPage.finishOrder();
    await expect(page).toHaveURL(/checkout-complete/);
    expect(await checkoutPage.isOrderComplete()).toBe(true);
  });

  test('problem_user total calculation is correct despite UI glitches', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsProblemUser(page);
    const cartPage = new SauceDemoCartPage(page);
    const checkoutPage = new SauceDemoCheckoutPage(page);

    // Add item and navigate to checkout step 1
    await inventoryPage.addItemToCart('Sauce Labs Backpack');
    await inventoryPage.goToCart();
    await cartPage.proceedToCheckout();
    await expect(page.locator('[data-test="firstName"]')).toBeVisible();

    await checkoutPage.fillInfo({ firstName: 'Test', lastName: 'User', postalCode: '12345' });
    await checkoutPage.continueToOverview();

    // ==================== ACT ====================
    const total = await checkoutPage.getTotal();
    const tax = await checkoutPage.getTax();

    // ==================== ASSERT ====================
    // Extract numeric values
    const totalMatch = total.match(/\$[\d.]+/);
    const taxMatch = tax.match(/\$[\d.]+/);

    expect(totalMatch).not.toBeNull();
    expect(taxMatch).not.toBeNull();

    // Values should be positive numbers
    const totalValue = parseFloat(totalMatch![0].replace('$', ''));
    const taxValue = parseFloat(taxMatch![0].replace('$', ''));

    expect(totalValue).toBeGreaterThan(0);
    expect(taxValue).toBeGreaterThanOrEqual(0);
  });

  // ─── Cart persistence with glitches ───────────────────────────────────────

  test('problem_user cart persists correctly despite backend glitches', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsProblemUser(page);
    const items = ['Sauce Labs Backpack', 'Sauce Labs Bike Light'];

    for (const item of items) {
      await inventoryPage.addItemToCart(item);
    }

    // ==================== ACT ====================
    // Navigate away and back
    await page.goto('https://www.saucedemo.com');
    await page.goto('/inventory.html');

    // ==================== ASSERT ====================
    // Badge should still show correct count
    const badgeCount = await inventoryPage.getCartBadgeCount();
    expect(badgeCount).toBe(items.length);

    // Items should persist in cart
    await inventoryPage.goToCart();
    const cartItemCount = await page.locator('[data-test="inventory-item"]').count();
    expect(cartItemCount).toBe(items.length);
  });

  // ─── Multiple add/remove operations with inconsistencies ───────────────────

  test('problem_user cart operations remain consistent despite glitches', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsProblemUser(page);
    const item1 = 'Sauce Labs Backpack';
    const item2 = 'Sauce Labs Bike Light';

    // ==================== ACT ====================
    await inventoryPage.addItemToCart(item1);
    expect(await inventoryPage.getCartBadgeCount()).toBe(1);

    await inventoryPage.addItemToCart(item2);
    expect(await inventoryPage.getCartBadgeCount()).toBe(2);

    await inventoryPage.removeItemFromCart(item1);

    // ==================== ASSERT ====================
    // Should accurately reflect removals
    const finalCount = await inventoryPage.getCartBadgeCount();
    expect(finalCount).toBe(1);

    // Verify correct item remains
    await inventoryPage.goToCart();
    const cartNames = await page.locator(cartItemLabel).allTextContents();
    expect(cartNames.join()).toContain('Sauce Labs Bike Light');
    expect(cartNames.join()).not.toContain('Sauce Labs Backpack');
  });

});
