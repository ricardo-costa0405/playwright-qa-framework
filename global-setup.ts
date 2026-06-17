/**
 * Global Setup — Playwright
 *
 * Logs in ONCE as standard_user, saves cookies + localStorage to
 * .auth/standard_user.json. Every project then injects this state
 * via storageState, eliminating 80+ login operations per CI run.
 *
 * Usage: added to playwright.config.ts under globalSetup.
 */
import { chromium, type FullConfig } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const AUTH_DIR  = path.resolve(import.meta.dirname ?? __dirname, '.auth');
const AUTH_FILE = path.join(AUTH_DIR, 'standard_user.json');

async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'https://www.saucedemo.com';

  // Ensure .auth directory exists
  await fs.promises.mkdir(AUTH_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page    = await context.newPage();

  try {
    await page.goto('/');
    await page.getByPlaceholder('Username').fill('standard_user');
    await page.getByPlaceholder('Password').fill('secret_sauce');
    await page.getByRole('button', { name: 'Login' }).click();

    // Validate login succeeded
    await page.locator('[data-test="inventory-container"]')
      .waitFor({ state: 'visible', timeout: 10_000 });

    // Save full state — cookies + localStorage + sessionStorage
    await context.storageState({ path: AUTH_FILE });
    console.log(`✓ Global setup: auth state saved to ${AUTH_FILE}`);
  } catch (err) {
    console.error('✗ Global setup: login failed', err);
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;
