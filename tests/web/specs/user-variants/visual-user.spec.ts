import { type Page } from '@playwright/test';
import { test, expect, SAUCE_CREDENTIALS } from '../../../../fixtures/saucedemo-fixtures';
import {
  SauceDemoCartPage,
  SauceDemoCheckoutPage,
  SauceDemoInventoryPage,
  SauceDemoLoginPage,
} from '../../../../pages/saucedemo';

/**
 * Swag Labs — Visual User Variant Tests @visual-user
 *
 * Covers:
 *   ✓ Visual user logs in successfully despite image render inconsistencies
 *   ✓ Visual user sees all products but with identical images (known glitch)
 *   ✓ Visual user can add items to cart without glitch
 *   ✓ Visual user sorting works correctly (no sort glitch unlike problem_user)
 *   ✓ Visual user can remove items (no remove glitch unlike problem_user)
 *   ✓ Visual user cart persists correctly across navigation
 *   ✓ Visual user can complete checkout (no checkout block unlike problem_user)
 *
 * Anti-patterns enforced → AAA pattern compliance
 *
 * Note: visual_user simulates image rendering issues where all product images
 * are identical (the generic dog-ear image) instead of the correct product
 * photos. All other functionality works as expected — no checkout blocks,
 * no sort reverts, no remove failures.
 *
 * ⚠ False-positive guard: these tests do NOT use the inventoryPage,
 * cartPage, or checkoutPage fixtures because those fixtures always log in
 * as standard_user.  Each test calls loginAsVisualUser() to ensure the
 * visual_user's image-swapped session is actually being exercised.
 */

const inventoryList = '[data-test="inventory-list"]';
const inventoryItems = '[data-test="inventory-item"]';
const inventoryImg = '.inventory_item_img img';
const cartBadge = '[data-test="shopping-cart-badge"]';

async function loginAsVisualUser(page: Page): Promise<{
  loginPage: SauceDemoLoginPage;
  inventoryPage: SauceDemoInventoryPage;
}> {
  const loginPage = new SauceDemoLoginPage(page);
  await loginPage.navigate();
  await loginPage.login(
    SAUCE_CREDENTIALS.visual.username,
    SAUCE_CREDENTIALS.visual.password
  );
  await expect(page).toHaveURL(/inventory\.html/);
  await expect(page.locator(inventoryList)).toBeVisible();

  return {
    loginPage,
    inventoryPage: new SauceDemoInventoryPage(page),
  };
}

test.describe('Visual User Variant @visual-user', () => {

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  // ─── Login ─────────────────────────────────────────────────────────────────

  test('visual_user logs in successfully despite image render inconsistencies', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { username, password } = SAUCE_CREDENTIALS.visual;
    const loginPage = new SauceDemoLoginPage(page);

    // ==================== ACT ====================
    await loginPage.navigate();
    await loginPage.login(username, password);

    // ==================== ASSERT ====================
    await expect(page).toHaveURL(/inventory\.html/);
    await expect(page).toHaveTitle('Swag Labs');
    await expect(page.locator(inventoryList)).toBeVisible();
  });

  // ─── Inventory and image glitches ─────────────────────────────────────────

  test('visual_user sees all products but with identical images (known image swap glitch)', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsVisualUser(page);

    // ==================== ACT ====================
    const itemCount = await inventoryPage.getItemCount();

    // ==================== ASSERT ====================
    // All 6 items load despite visual glitch
    expect(itemCount).toBe(6);

    const names = await inventoryPage.getItemNames();
    expect(names.length).toBe(6);
    expect(names).toContain('Sauce Labs Backpack');

    // Images are present in the DOM
    const images = page.locator(inventoryImg);
    const imageCount = await images.count();
    expect(imageCount).toBe(6);

    // visual_user glitch: all images have the same src (generic dog-ear image)
    const imageSrcs = await images.evaluateAll(
      (imgs: HTMLImageElement[]) => imgs.map((img) => img.getAttribute('src'))
    );
    const uniqueSrcs = new Set(imageSrcs);
    expect(uniqueSrcs.size).toBe(1);
  });

  // ─── Add to cart — no glitch ─────────────────────────────────────────────

  test('visual_user can add items to cart without glitch', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsVisualUser(page);
    const item = 'Sauce Labs Backpack';

    // ==================== ACT ====================
    await inventoryPage.addItemToCart(item);

    // ==================== ASSERT ====================
    const badgeCount = await inventoryPage.getCartBadgeCount();
    expect(badgeCount).toBe(1);

    await inventoryPage.goToCart();
    await expect(page).toHaveURL(/cart\.html/);

    const cartItemCount = await page.locator(inventoryItems).count();
    expect(cartItemCount).toBe(1);
  });

  // ─── Sort — no glitch (unlike problem_user) ─────────────────────────────

  test('visual_user sorting works correctly (no sort glitch unlike problem_user)', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsVisualUser(page);

    // ==================== ACT ====================
    await inventoryPage.sortBy('za');

    // ==================== ASSERT ====================
    const names = await inventoryPage.getItemNames();
    const sorted = [...names].sort().reverse();
    expect(names).toEqual(sorted);
  });

  test('visual_user price sorting works correctly', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsVisualUser(page);

    // ==================== ACT ====================
    await inventoryPage.sortBy('lohi');

    // ==================== ASSERT ====================
    const prices = await inventoryPage.getItemPrices();
    const sorted = [...prices].sort((a, b) => a - b);
    expect(prices).toEqual(sorted);
  });

  // ─── Remove from cart — no glitch (unlike problem_user) ───────────────────

  test('visual_user can remove items from cart (no remove glitch unlike problem_user)', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsVisualUser(page);
    const item1 = 'Sauce Labs Backpack';
    const item2 = 'Sauce Labs Bike Light';

    await inventoryPage.addItemToCart(item1);
    await inventoryPage.addItemToCart(item2);
    expect(await inventoryPage.getCartBadgeCount()).toBe(2);

    // ==================== ACT ====================
    await inventoryPage.removeItemFromCart(item1);

    // ==================== ASSERT ====================
    const badgeCount = await inventoryPage.getCartBadgeCount();
    expect(badgeCount).toBe(1);

    await inventoryPage.goToCart();
    const cartItemNames = await page.locator('[data-test="inventory-item-name"]').allTextContents();
    expect(cartItemNames).toEqual([item2]);
  });

  // ─── Cart persistence ────────────────────────────────────────────────────

  test('visual_user cart persists correctly across navigation', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsVisualUser(page);
    const items = ['Sauce Labs Backpack', 'Sauce Labs Bike Light'];

    for (const item of items) {
      await inventoryPage.addItemToCart(item);
    }

    // ==================== ACT ====================
    // Navigate away and back
    await page.goto('https://www.saucedemo.com');
    await page.goto('/inventory.html');

    // ==================== ASSERT ====================
    const badgeCount = await inventoryPage.getCartBadgeCount();
    expect(badgeCount).toBe(items.length);

    await inventoryPage.goToCart();
    const cartItemCount = await page.locator('[data-test="inventory-item"]').count();
    expect(cartItemCount).toBe(items.length);
  });

  // ─── Checkout — no block (unlike problem_user) ───────────────────────────

  test('visual_user can complete checkout successfully (no checkout block unlike problem_user)', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsVisualUser(page);
    const cartPage = new SauceDemoCartPage(page);
    const checkoutPage = new SauceDemoCheckoutPage(page);

    // Add item and start checkout
    await inventoryPage.addItemToCart('Sauce Labs Backpack');
    await inventoryPage.goToCart();
    await cartPage.proceedToCheckout();
    await expect(page.locator('[data-test="firstName"]')).toBeVisible();

    // ==================== ACT ====================
    await checkoutPage.fillInfo({
      firstName: 'Ricardo',
      lastName: 'Test',
      postalCode: '1000',
    });
    await checkoutPage.continueToOverview();

    // ==================== ASSERT ====================
    // Unlike problem_user, visual_user can reach checkout-step-two
    await expect(page).toHaveURL(/checkout-step-two/);
    await expect(checkoutPage.itemTotalLabel).toBeVisible();
    await expect(checkoutPage.taxLabel).toBeVisible();
    await expect(checkoutPage.totalLabel).toBeVisible();

    // Finish the order
    await checkoutPage.finishOrder();
    await expect(page).toHaveURL(/checkout-complete/);
    await expect(page.locator('[data-test="complete-header"]')).toBeVisible();
  });

});
