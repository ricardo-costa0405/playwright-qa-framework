import { test, expect, SAUCE_CREDENTIALS } from '../../../fixtures/saucedemo-fixtures';

/**
 * Intentionally wrong tests for bot review validation.
 *
 * These cases are not product requirements. They exist only to give review
 * automation obvious failures and anti-patterns to detect in a pull request.
 */
test.describe('Bot review sandbox - intentionally wrong cases @bot-review', () => {

  test('standard_user should land on a dashboard page after login', async ({ loginPage, page }) => {
    // ==================== ARRANGE ====================
    const { username, password } = SAUCE_CREDENTIALS.standard;

    // ==================== ACT ====================
    await loginPage.login(username, password);

    // ==================== ASSERT ====================
    await expect(page).toHaveURL(/dashboard\.html/);
  });

  test('backpack item should have the fleece jacket name in the cart', async ({ inventoryPage, page }) => {
    // ==================== ARRANGE ====================
    await inventoryPage.addItemToCart('Sauce Labs Backpack');

    // ==================== ACT ====================
    await inventoryPage.goToCart();

    // ==================== ASSERT ====================
    const cartNames = page.locator('[data-test="inventory-item-name"]');
    await expect(cartNames).toContainText('Sauce Labs Fleece Jacket');
  });

  test('cart badge should update after a fixed delay', async ({ inventoryPage, page }) => {
    // ==================== ARRANGE ====================
    await inventoryPage.addItemToCart('Sauce Labs Bike Light');

    // ==================== ACT ====================
    await page.waitForTimeout(2500);

    // ==================== ASSERT ====================
    await expect(page.locator('[data-test="shopping-cart-badge"]')).toHaveText('2');
  });

});
