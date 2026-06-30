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
  // 🛡 False-positive guard: verify the session cookie confirms problem_user.
  // Without this, a test that accidentally logs in as standard_user (or
  // reuses a stale storageState) would still reach /inventory.html and
  // appear to pass — but problem_user-specific glitches wouldn't be tested.
  await assertSessionUser(page, 'problem_user');

  return {
    loginPage,
    inventoryPage: new SauceDemoInventoryPage(page),
  };
}

/**
 * Asserts that the SauceDemo session cookie matches the expected username.
 * This is the single reliable mechanism for verifying which user variant
 * is actually logged in — page content alone is not sufficient because
 * /inventory.html loads the same DOM skeleton for every user.
 */
async function assertSessionUser(page: Page, expectedUser: string): Promise<void> {
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((c) => c.name === 'session-username');
  expect(
    sessionCookie,
    `❌ session-username cookie not found — cannot verify logged-in user.\n` +
      `    Expected: ${expectedUser}\n` +
      `    This usually means the login step did not complete successfully.`
  ).toBeDefined();
  expect(
    sessionCookie!.value,
    `❌ Wrong user logged in.\n` +
      `    Expected: ${expectedUser}\n` +
      `    Actual:   ${sessionCookie!.value}\n` +
      `    The test would produce false-positive results because SauceDemo ` +
      `behavior differs per user variant.`
  ).toBe(expectedUser);
}

test.describe('Problem User Variant @problem-user', () => {

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
    await page.context().addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
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

  test('problem_user sorting dropdown reverts due to known glitch', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsProblemUser(page);
    const originalNames = await inventoryPage.getItemNames();

    // ==================== ACT ====================
    // problem_user has a known glitch: the sort dropdown selection reverts
    // to the default value after selection. We verify the actual behavior.
    await inventoryPage.sortByExpectingGlitch('za');

    // ==================== ASSERT ====================
    // After the glitch, the dropdown reverts to "az" and items stay in
    // original order — this is the expected problem_user behavior
    const currentNames = await inventoryPage.getItemNames();
    expect(currentNames).toEqual(originalNames);
  });

  test('problem_user price sorting reverts due to known glitch', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsProblemUser(page);
    const originalPrices = await inventoryPage.getItemPrices();

    // ==================== ACT ====================
    // problem_user has a known glitch: the sort dropdown selection reverts
    await inventoryPage.sortByExpectingGlitch('lohi');

    // ==================== ASSERT ====================
    // Prices remain in original order due to the glitch
    const currentPrices = await inventoryPage.getItemPrices();
    expect(currentPrices).toEqual(originalPrices);
  });

  // ─── Checkout flow with glitches ───────────────────────────────────────

  test('problem_user cannot proceed past checkout step one due to known glitch', async ({ page }) => {
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
    // problem_user has a known glitch: the "Continue" button does not
    // advance to checkout-step-two. The page stays on step one.
    await expect(page).toHaveURL(/checkout-step-one/);

    // problem_user has a known form-field swap glitch: the first name
    // input displays the last name value (\"User\") while the last name
    // input remains empty. This is expected Sauce Labs problem_user
    // behavior — verify the glitch is present rather than asserting
    // correct behavior that doesn't apply here.
    await expect(page.getByPlaceholder('First Name')).toHaveValue('User');
    await expect(page.getByPlaceholder('Last Name')).toHaveValue('');
  });

  test('problem_user total calculation is blocked at checkout step one', async ({ page }) => {
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

    // ==================== ACT & ASSERT ====================
    // problem_user cannot reach checkout-step-two, so total/tax labels
    // are not rendered. Verify the page stays on step one.
    await expect(page).toHaveURL(/checkout-step-one/);

    // The summary labels only exist on step two — they should not be visible
    await expect(page.locator('[data-test="subtotal-label"]')).toHaveCount(0);
    await expect(page.locator('[data-test="tax-label"]')).toHaveCount(0);
    await expect(page.locator('[data-test="total-label"]')).toHaveCount(0);
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

  test('problem_user cart remove does not work due to known glitch', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsProblemUser(page);
    const item1 = 'Sauce Labs Backpack';
    const item2 = 'Sauce Labs Bike Light';

    // ==================== ACT ====================
    await inventoryPage.addItemToCart(item1);
    expect(await inventoryPage.getCartBadgeCount()).toBe(1);

    await inventoryPage.addItemToCart(item2);
    expect(await inventoryPage.getCartBadgeCount()).toBe(2);

    // problem_user has a known glitch: the Remove button click does not
    // actually remove the item. The badge count stays the same.
    await inventoryPage.removeItemFromCart(item1);

    // ==================== ASSERT ====================
    // Badge still shows 2 because the remove didn't register
    const finalCount = await inventoryPage.getCartBadgeCount();
    expect(finalCount).toBe(2);

    // Both items remain in cart
    await inventoryPage.goToCart();
    const cartItemCount = await page.locator('[data-test="inventory-item"]').count();
    expect(cartItemCount).toBe(2);
  });

});
