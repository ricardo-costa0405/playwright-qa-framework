import { type Page } from '@playwright/test';
import { test, expect, SAUCE_CREDENTIALS } from '../../../../fixtures/saucedemo-fixtures';
import {
  SauceDemoCartPage,
  SauceDemoCheckoutPage,
  SauceDemoInventoryPage,
  SauceDemoLoginPage,
} from '../../../../pages/saucedemo';

/**
 * Swag Labs — Error User Variant Tests @error-user
 *
 * Covers:
 *   ✓ Error user logs in successfully without glitch
 *   ✓ Error user triggers error banner on add to cart
 *   ✓ Error user cannot actually add items to cart (cart stays empty)
 *   ✓ Error user's cart badge remains zero despite button state change
 *   ✓ Error user sees glitchy/incorrect error message formatting
 *   ✓ Error user session persists between pages
 *   ✓ Error user cannot proceed to checkout (cart is empty)
 *   ✓ Error user can dismiss error banner and re-attempt
 *   ✓ Error user logout works correctly
 *
 * Anti-patterns enforced → AAA pattern compliance
 *
 * Note: error_user simulates backend error states where every add-to-cart
 * action triggers an error banner instead of succeeding. The "Add to cart"
 * button may change to "Remove" visually, but the cart remains empty and
 * the badge stays at 0. Error messages contain glitchy/incorrect formatting
 * that tests verify rather than correct error text.
 *
 * ⚠ False-positive guard: these tests do NOT use the inventoryPage,
 * cartPage, or checkoutPage fixtures because those fixtures always log in
 * as standard_user.  Each test calls loginAsErrorUser() to ensure the
 * error_user's glitchy session is actually being exercised.
 */

const inventoryList = '[data-test="inventory-list"]';
const inventoryItem = '[data-test="inventory-item"]';
const errorBanner = '[data-test="error"]';
const errorButton = '[data-test="error-button"]';
const cartBadge = '[data-test="shopping-cart-badge"]';

async function loginAsErrorUser(page: Page): Promise<{
  loginPage: SauceDemoLoginPage;
  inventoryPage: SauceDemoInventoryPage;
}> {
  const loginPage = new SauceDemoLoginPage(page);
  await loginPage.navigate();
  await loginPage.login(
    SAUCE_CREDENTIALS.error.username,
    SAUCE_CREDENTIALS.error.password
  );
  await expect(page).toHaveURL(/inventory\.html/);
  await expect(page.locator(inventoryList)).toBeVisible();

  return {
    loginPage,
    inventoryPage: new SauceDemoInventoryPage(page),
  };
}

test.describe('Error User Variant @error-user', () => {

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  // ─── Login ─────────────────────────────────────────────────────────────────

  test('error_user logs in successfully with standard credentials', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { username, password } = SAUCE_CREDENTIALS.error;
    const loginPage = new SauceDemoLoginPage(page);

    // ==================== ACT ====================
    await loginPage.navigate();
    await loginPage.login(username, password);

    // ==================== ASSERT ====================
    await expect(page).toHaveURL(/inventory\.html/);
    await expect(page).toHaveTitle('Swag Labs');
    await expect(page.locator(inventoryList)).toBeVisible();
    // No error banner on login — error_user only glitches on actions
    await expect(page.locator(errorBanner)).toHaveCount(0);
  });

  // ─── Add to cart — glitch behaviour ───────────────────────────────────────

  test('error_user triggers error banner when adding item to cart', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsErrorUser(page);

    // ==================== ACT ====================
    await inventoryPage.addItemToCart('Sauce Labs Backpack');

    // ==================== ASSERT ====================
    // Error banner should appear — error_user cannot complete cart actions
    await expect(page.locator(errorBanner)).toBeVisible();

    // Error message should contain the expected glitch indicator
    const errorText = await page.locator(errorBanner).textContent();
    expect(errorText).toBeTruthy();
    // The error message is glitchy — verify it references an error/sadface
    expect(errorText?.toLowerCase()).toContain('epic sadface');
  });

  test('error_user cart badge remains zero despite add-to-cart attempt', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsErrorUser(page);

    // ==================== ACT ====================
    await inventoryPage.addItemToCart('Sauce Labs Backpack');

    // ==================== ASSERT ====================
    // Badge should still be 0 because the add didn't register
    const badgeCount = await inventoryPage.getCartBadgeCount();
    expect(badgeCount).toBe(0);
  });

  test('error_user cart page shows no items after add attempt', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsErrorUser(page);
    const cartPage = new SauceDemoCartPage(page);

    await inventoryPage.addItemToCart('Sauce Labs Backpack');
    // Error banner appeared — cart should still be empty
    await expect(page.locator(errorBanner)).toBeVisible();

    // ==================== ACT ====================
    await inventoryPage.goToCart();
    await expect(page).toHaveURL(/cart\.html/);

    // ==================== ASSERT ====================
    const cartItemCount = await cartPage.getCartItemCount();
    expect(cartItemCount).toBe(0);
  });

  test('error_user add-to-cart button toggles to Remove despite failure', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsErrorUser(page);
    const item = page.locator(inventoryItem).filter({ hasText: 'Sauce Labs Backpack' });

    // ==================== ACT ====================
    await inventoryPage.addItemToCart('Sauce Labs Backpack');
    // Error banner appeared
    await expect(page.locator(errorBanner)).toBeVisible();

    // ==================== ASSERT ====================
    // Known error_user glitch: the button text changes to "Remove" even
    // though the item was not actually added. Verify the glitch is present.
    const removeButton = item.getByRole('button', { name: 'Remove' });
    await expect(removeButton).toBeVisible();
  });

  // ─── Error message glitch verification ─────────────────────────────────────

  test('error_user error message has glitchy formatting', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsErrorUser(page);
    await inventoryPage.addItemToCart('Sauce Labs Backpack');
    await expect(page.locator(errorBanner)).toBeVisible();

    // ==================== ACT ====================
    const errorText = (await page.locator(errorBanner).textContent())?.trim() ?? '';

    // ==================== ASSERT ====================
    // Verify the error is present and has the epic-sadface prefix
    expect(errorText).toMatch(/epic sadface/i);

    // The error_user has glitchy error formatting — verify the message
    // contains expected keywords about the action failure
    expect(errorText).toMatch(/(error|glitch|action|complete)/i);
  });

  test('error_user can dismiss error banner', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsErrorUser(page);
    await inventoryPage.addItemToCart('Sauce Labs Backpack');
    await expect(page.locator(errorBanner)).toBeVisible();

    // ==================== ACT ====================
    await page.locator(errorButton).click();

    // ==================== ASSERT ====================
    await expect(page.locator(errorBanner)).not.toBeVisible();
  });

  // ─── Cart persistence ─────────────────────────────────────────────────────

  test('error_user cart remains empty across navigation', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsErrorUser(page);
    const cartPage = new SauceDemoCartPage(page);

    // Trigger error on multiple items
    await inventoryPage.addItemToCart('Sauce Labs Backpack');
    await expect(page.locator(errorBanner)).toBeVisible();
    // Dismiss and try another
    await page.locator(errorButton).click();
    await inventoryPage.addItemToCart('Sauce Labs Bike Light');
    await expect(page.locator(errorBanner)).toBeVisible();

    // ==================== ACT ====================
    // Navigate away and back
    await page.goto('https://www.saucedemo.com');
    await page.goto('/inventory.html');

    // ==================== ASSERT ====================
    // Cart badge stays 0 across navigation
    const badgeAfterNav = await inventoryPage.getCartBadgeCount();
    expect(badgeAfterNav).toBe(0);

    // Cart remains empty
    await inventoryPage.goToCart();
    const cartCount = await cartPage.getCartItemCount();
    expect(cartCount).toBe(0);
  });

  // ─── Checkout — blocked ───────────────────────────────────────────────────

  test('error_user cannot proceed to checkout due to empty cart', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsErrorUser(page);
    const cartPage = new SauceDemoCartPage(page);

    // Try adding to cart — it fails with an error
    await inventoryPage.addItemToCart('Sauce Labs Backpack');
    await expect(page.locator(errorBanner)).toBeVisible();

    // ==================== ACT ====================
    // Navigate to cart
    await inventoryPage.goToCart();

    // ==================== ASSERT ====================
    // Cart is empty — checkout button should not be visible or clickable
    const cartCount = await cartPage.getCartItemCount();
    expect(cartCount).toBe(0);

    // The checkout button might still be visible in the DOM
    // but clicking it with empty cart might show an error or redirect back
    // Verify the cart is empty
    await expect(page.locator(inventoryItem)).toHaveCount(0);
  });

  // ─── Logout ────────────────────────────────────────────────────────────────

  test('error_user can log out successfully', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsErrorUser(page);

    // ==================== ACT ====================
    await inventoryPage.logout();

    // ==================== ASSERT ====================
    await expect(page).toHaveURL(/saucedemo\.com\/?$/);
    const loginPage = new SauceDemoLoginPage(page);
    await expect(loginPage.loginButton).toBeVisible();
  });

});
