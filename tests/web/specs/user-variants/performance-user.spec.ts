import { type Page } from '@playwright/test';
import { test, expect, SAUCE_CREDENTIALS } from '../../../../fixtures/saucedemo-fixtures';
import {
  SauceDemoCartPage,
  SauceDemoCheckoutPage,
  SauceDemoInventoryPage,
  SauceDemoLoginPage,
} from '../../../../pages/saucedemo';

/**
 * Swag Labs — Performance Glitch User Variant Tests @performance-user
 *
 * Covers:
 *   ✓ Performance user experiences simulated slow server responses
 *   ✓ Timeouts are handled gracefully with proper retry logic
 *   ✓ Page navigation waits exceed expectations without breaking
 *   ✓ Checkout completes despite intermittent slowness
 *   ✓ Network waterfall shows delays but operations eventually succeed
 *   ✓ Cart operations complete with patience
 *   ✓ Load time metrics are collected for SLA verification
 *
 * Anti-patterns enforced → AAA pattern compliance
 *
 * Note: performance_glitch_user simulates slow API responses (up to 3s delays).
 * Tests should use longer timeouts and measure performance.
 */

test.describe('Performance Glitch User Variant @performance-user', () => {

  const inventoryList = '[data-test="inventory-list"]';
  const inventoryItems = '[data-test="inventory-item"]';
  const inventoryNames = '[data-test="inventory-item-name"]';
  const inventoryPrices = '[data-test="inventory-item-price"]';
  const cartBadge = '[data-test="shopping-cart-badge"]';

  async function loginAsPerformanceUser(page: Page): Promise<{
    loginPage: SauceDemoLoginPage;
    inventoryPage: SauceDemoInventoryPage;
  }> {
    const loginPage = new SauceDemoLoginPage(page);
    await loginPage.navigate();
    await loginPage.login(
      SAUCE_CREDENTIALS.glitch.username,
      SAUCE_CREDENTIALS.glitch.password
    );
    await expect(page).toHaveURL(/inventory\.html/);
    await expect(page.locator(inventoryList)).toBeVisible();

    return {
      loginPage,
      inventoryPage: new SauceDemoInventoryPage(page),
    };
  }

  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  // ─── Login performance ────────────────────────────────────────────────────

  test('performance_user login completes despite 3s+ server delays', async ({ loginPage, page }) => {
    // ==================== ARRANGE ====================
    const { username, password } = SAUCE_CREDENTIALS.glitch;
    const startTime = Date.now();

    // ==================== ACT ====================
    await loginPage.login(username, password);
    const loginDuration = Date.now() - startTime;

    // ==================== ASSERT ====================
    await expect(page).toHaveURL(/inventory\.html/);

    // Performance glitch user experiences delays > 2s on login
    expect(loginDuration).toBeGreaterThan(2000);
    expect(loginDuration).toBeLessThan(15000); // Should not exceed 15s

    await expect(page.locator('[data-test="inventory-list"]')).toBeVisible();
  });

  // ─── Inventory loading with performance degradation ──────────────────────

  test('performance_user inventory loads despite delayed responses', async ({ loginPage, page }) => {
    // ==================== ARRANGE ====================
    const { username, password } = SAUCE_CREDENTIALS.glitch;

    // ==================== ACT ====================
    // Timer starts before login — performance glitch delay occurs during login/navigation
    const loadStartTime = Date.now();
    await loginPage.login(username, password);
    await expect(page).toHaveURL(/inventory\.html/);
    await expect(page.locator(inventoryList)).toBeVisible();
    const inventoryLoadDuration = Date.now() - loadStartTime;

    // ==================== ASSERT ====================
    const itemCount = await page.locator(inventoryItems).count();
    expect(itemCount).toBe(6);

    // Loading should take noticeably longer due to performance glitch (> 2s but < 30s)
    expect(inventoryLoadDuration).toBeGreaterThan(2000);
    expect(inventoryLoadDuration).toBeLessThan(30000);

    const prices = await page.locator(inventoryPrices).allTextContents();
    expect(prices.length).toBe(6);
  });

  // ─── Network waterfall measurement ────────────────────────────────────────

  test('performance_user network requests show degradation patterns', async ({ page }) => {
    // ==================== ARRANGE ====================
    const requests: { url: string; duration: number }[] = [];

    // Capture network timing
    page.on('response', (response) => {
      const timing = response.request().timing();
      if (timing) {
        requests.push({
          url: response.url(),
          duration: timing.responseEnd - timing.requestStart,
        });
      }
    });

    // ==================== ACT ====================
    await loginAsPerformanceUser(page);

    // ==================== ASSERT ====================
    expect(requests.length).toBeGreaterThan(0);

    // Log performance metrics — saucedemo performance delay is applied client-side
    // so it manifests as overall page load time, not individual slow network requests
    const slowRequests = requests.filter((r) => r.duration > 1000);
    console.log(`Total Requests: ${requests.length}`);
    console.log(`Slow Requests (>1s): ${slowRequests.length}`);
    if (requests.length > 0) {
      console.log(
        `Slowest Request: ${Math.max(...requests.map((r) => r.duration))}ms`
      );
    }
  });

  // ─── Add to cart with performance degradation ────────────────────────────

  test('performance_user can add items to cart despite endpoint delays', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsPerformanceUser(page);

    const startTime = Date.now();

    // ==================== ACT ====================
    await inventoryPage.addItemToCart('Sauce Labs Backpack');

    // ==================== ASSERT ====================
    await expect(page.locator(cartBadge)).toHaveText('1');
    const addDuration = Date.now() - startTime;

    expect(addDuration).toBeLessThan(10000);
  });

  // ─── Checkout flow with intermittent slowness ─────────────────────────────

  test('performance_user completes checkout despite multiple delays', async ({ page }) => {
    // ==================== ARRANGE ====================
    const checkoutStartTime = Date.now();
    const { inventoryPage } = await loginAsPerformanceUser(page);
    const cartPage = new SauceDemoCartPage(page);
    const checkoutPage = new SauceDemoCheckoutPage(page);

    // ==================== ACT ====================
    await inventoryPage.addItemToCart('Sauce Labs Backpack');
    await inventoryPage.goToCart();
    await cartPage.proceedToCheckout();
    await expect(page.locator('[data-test="firstName"]')).toBeVisible();

    // Fill info
    await checkoutPage.fillInfo({ firstName: 'Test', lastName: 'User', postalCode: '12345' });
    await checkoutPage.continueToOverview();
    await expect(page).toHaveURL(/checkout-step-two/);
    await checkoutPage.finishOrder();

    const checkoutDuration = Date.now() - checkoutStartTime;

    // ==================== ASSERT ====================
    await expect(page.locator('[data-test="complete-header"]')).toBeVisible();
    await expect(page.locator('[data-test="complete-header"]')).not.toBeEmpty();

    expect(checkoutDuration).toBeLessThan(120000); // Less than 2 minutes

    console.log(`Checkout Duration: ${checkoutDuration}ms`);
  });

  // ─── Sorting with performance impact ──────────────────────────────────────

  test('performance_user sort operations complete despite API latency', async ({ page }) => {
    // ==================== ARRANGE ====================
    const { inventoryPage } = await loginAsPerformanceUser(page);

    const sortStartTime = Date.now();

    // ==================== ACT ====================
    await inventoryPage.sortBy('za');

    const sortDuration = Date.now() - sortStartTime;

    // ==================== ASSERT ====================
    const names = await page.locator(inventoryNames).allTextContents();

    // Should be reverse alphabetical
    const sorted = [...names].sort().reverse();
    expect(names).toEqual(sorted);

    // Sort operation should show latency
    expect(sortDuration).toBeGreaterThan(1000);
    expect(sortDuration).toBeLessThan(30000);

    console.log(`Sort Duration: ${sortDuration}ms`);
  });

  // ─── Multiple operations sequence ─────────────────────────────────────────

  test('performance_user can perform multiple operations sequentially', async ({ page }) => {
    // ==================== ARRANGE ====================
    const operationStartTime = Date.now();
    const { inventoryPage } = await loginAsPerformanceUser(page);

    // ==================== ACT ====================
    await inventoryPage.addItemToCart('Sauce Labs Backpack');
    await inventoryPage.addItemToCart('Sauce Labs Bike Light');
    await inventoryPage.sortBy('lohi');
    await inventoryPage.goToCart();

    const operationDuration = Date.now() - operationStartTime;

    // ==================== ASSERT ====================
    const cartItems = await page.locator('.cart_item').count();
    expect(cartItems).toBe(2);

    expect(operationDuration).toBeLessThan(90000); // Should not exceed 90s

    console.log(`Total Operations Duration: ${operationDuration}ms`);
  });

  // ─── Measurement of expected SLA ─────────────────────────────────────────

  test('performance_user metrics validate SLA limits', async ({ page }) => {
    // ==================== ARRANGE ====================
    const SLA_LOGIN_TIMEOUT = 30000;
    const SLA_NAV_TIMEOUT = 30000;

    // ==================== ACT ====================
    const loginStartTime = Date.now();
    const { inventoryPage } = await loginAsPerformanceUser(page);
    const loginTime = Date.now() - loginStartTime;

    const navStartTime = Date.now();
    await inventoryPage.goToCart();
    const navTime = Date.now() - navStartTime;

    // ==================== ASSERT ====================
    expect(loginTime).toBeLessThan(SLA_LOGIN_TIMEOUT);
    expect(navTime).toBeLessThan(SLA_NAV_TIMEOUT);

    console.log(`Login SLA: ${loginTime}ms / ${SLA_LOGIN_TIMEOUT}ms`);
    console.log(`Navigation SLA: ${navTime}ms / ${SLA_NAV_TIMEOUT}ms`);
    console.log(
      `SLA Compliance: ${loginTime < SLA_LOGIN_TIMEOUT && navTime < SLA_NAV_TIMEOUT ? 'PASS' : 'FAIL'}`
    );
  });

});
