import { test as base, expect } from '@playwright/test';
import { SauceDemoLoginPage }    from '../pages/saucedemo/SauceDemoLoginPage';
import { SauceDemoInventoryPage } from '../pages/saucedemo/SauceDemoInventoryPage';
import { SauceDemoCartPage }     from '../pages/saucedemo/SauceDemoCartPage';
import { SauceDemoCheckoutPage } from '../pages/saucedemo/SauceDemoCheckoutPage';

// ─── Credentials ─────────────────────────────────────────────────────────────
// All Swag Labs users share the same password.
// Each user type exposes a different behaviour useful for testing:
//
//  standard_user          → fully functional, the happy path
//  locked_out_user        → blocked at login — tests error state
//  problem_user           → logged in but with broken images / wrong names
//  performance_glitch_user → logged in but artificially slow (>5 s)
//  error_user             → every add to cart action triggers an error banner
export const SAUCE_CREDENTIALS = {
  standard: { username: 'standard_user',           password: 'secret_sauce' },
  locked:   { username: 'locked_out_user',          password: 'secret_sauce' },
  problem:  { username: 'problem_user',             password: 'secret_sauce' },
  glitch:   { username: 'performance_glitch_user',  password: 'secret_sauce' },
  error:    { username: 'error_user',               password: 'secret_sauce' },
} as const;

// ─── Session validation helper ──────────────────────────────────────────────

/**
 * Validates that the current page is authenticated.
 * Fails fast with a clear "authentication failed" message instead of
 * a cryptic "element not found" downstream.
 */
async function validateSession(page: import('@playwright/test').Page): Promise<void> {
  await expect(
    page.locator('[data-test="inventory-container"]'),
    '❌ Authentication failed — inventory container not found. Check BasePage URL or credentials.'
  ).toBeVisible({ timeout: 10_000 });
  await expect(
    page.locator('[data-test="title"]')
  ).toHaveText('Products');
}

// ─── Full storage cleanup ───────────────────────────────────────────────────

/**
 * Clears all browser storage to prevent cross-test leaks.
 * cookies + localStorage + sessionStorage.
 *
 * Why: SPA auth tokens increasingly live in localStorage.
 * clearCookies() alone leaves stale tokens that non-deterministically
 * bleed into dependent tests — near-impossible to debug in CI.
 */
async function clearAllStorage(page: import('@playwright/test').Page): Promise<void> {
  await page.context().clearCookies();
  // Context-level storage clearing — avoids SecurityError from page.evaluate
  await page.context().addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

// ─── Fixture types ───────────────────────────────────────────────────────────
type SauceDemoFixtures = {
  /** Arrives at the login page, ready to interact */
  loginPage: SauceDemoLoginPage;

  /**
   * Authenticated page fixture — logs in once as standard_user.
   * All dependent fixtures (inventoryPage, cartPage, checkoutPage)
   * extend from this instead of duplicating the login flow.
   */
  authenticatedPage: import('@playwright/test').Page;

  /** Already authenticated as standard_user, on the inventory page */
  inventoryPage: SauceDemoInventoryPage;

  /** Already authenticated + navigated to the cart page */
  cartPage: SauceDemoCartPage;

  /** Already authenticated + navigated to checkout step 1 */
  checkoutPage: SauceDemoCheckoutPage;
};

// ─── Extended test ───────────────────────────────────────────────────────────
export const test = base.extend<SauceDemoFixtures>({

  loginPage: async ({ page }, use) => {
    const loginPage = new SauceDemoLoginPage(page);
    await loginPage.navigate();
    await use(loginPage);
  },

  // ── Single source of truth for authentication ──────────────────────────
  // inventoryPage, cartPage, checkoutPage all depend on this.
  // No more 3 independent login flows per test.
  authenticatedPage: async ({ page }, use) => {
    // If storageState was injected (global setup), we may already be on /inventory.html.
    // Navigate to base and check — only login if not already authenticated.
    const alreadyOnInventory = page.url().includes('/inventory.html');
    if (!alreadyOnInventory) {
      const loginPage = new SauceDemoLoginPage(page);
      await loginPage.navigate();
      await loginPage.login(
        SAUCE_CREDENTIALS.standard.username,
        SAUCE_CREDENTIALS.standard.password
      );
    }
    await validateSession(page);
    await use(page);

    // Full storage cleanup — not just cookies
    await clearAllStorage(page);
  },

  inventoryPage: async ({ authenticatedPage }, use) => {
    const inventoryPage = new SauceDemoInventoryPage(authenticatedPage);
    // Already on /inventory.html from authenticatedPage login
    await expect(authenticatedPage.locator('.inventory_list')).toBeVisible();
    await use(inventoryPage);
    // Storage cleanup handled by authenticatedPage teardown
  },

  cartPage: async ({ authenticatedPage }, use) => {
    const inventoryPage = new SauceDemoInventoryPage(authenticatedPage);
    await expect(authenticatedPage.locator('.inventory_list')).toBeVisible();
    await inventoryPage.goToCart();

    const cartPage = new SauceDemoCartPage(authenticatedPage);
    await expect(authenticatedPage.locator('.title')).toHaveText('Your Cart');
    await use(cartPage);
    // Storage cleanup handled by authenticatedPage teardown
  },

  checkoutPage: async ({ authenticatedPage }, use) => {
    const inventoryPage = new SauceDemoInventoryPage(authenticatedPage);
    await expect(authenticatedPage.locator('.inventory_list')).toBeVisible();
    // Add one item so the cart isn't empty before checkout
    await inventoryPage.addItemToCart('Sauce Labs Backpack');
    await inventoryPage.goToCart();

    const cartPage = new SauceDemoCartPage(authenticatedPage);
    await cartPage.proceedToCheckout();

    const checkoutPage = new SauceDemoCheckoutPage(authenticatedPage);
    await expect(authenticatedPage.locator('[data-test="firstName"]')).toBeVisible();
    await use(checkoutPage);
    // Storage cleanup handled by authenticatedPage teardown
  },

});

export { expect };
