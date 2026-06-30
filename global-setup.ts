/**
 * Global Setup — Playwright
 *
 * Generates per-browser auth state files so each project
 * (chromium / firefox / webkit) uses its own compatible
 * storage state. Fixes Firefox failures when run locally
 * alongside Chromium — Playwright's globalSetup runs ONCE
 * locally, so a single shared auth file would contain
 * Chromium-specific data that Firefox can't read correctly.
 *
 * Browser selection:
 *   Reads PW_BROWSER env var (chromium | firefox | webkit).
 *   - In CI: PW_BROWSER is set per matrix job → only auth for
 *     that browser is generated (no extra login overhead).
 *   - Locally: PW_BROWSER is not set → generates auth for all
 *     3 browsers so every project has correct state.
 *
 * Each auth file lives at .auth/standard_user-<browser>.json.
 */
import { chromium, firefox, webkit, type FullConfig, type Browser } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const AUTH_DIR = path.resolve(import.meta.dirname ?? __dirname, '.auth');

const BROWSERS = ['chromium', 'firefox', 'webkit'] as const;

async function launchBrowser(browserName: string): Promise<Browser> {
  switch (browserName) {
    case 'firefox':
      return await firefox.launch();
    case 'webkit':
      return await webkit.launch();
    case 'chromium':
    default:
      return await chromium.launch();
  }
}

async function loginAndSaveState(baseURL: string, browserName: string): Promise<void> {
  const authFile = path.join(AUTH_DIR, `standard_user-${browserName}.json`);

  const browser = await launchBrowser(browserName);
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

    // Save per-browser state — cookies + localStorage + sessionStorage
    await context.storageState({ path: authFile });
    console.log(`✓ Global setup: auth saved to ${authFile}`);
  } catch (err) {
    console.error(`✗ Global setup: login failed for ${browserName}`, err);
    throw err;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'https://www.saucedemo.com';

  // Ensure .auth directory exists
  await fs.promises.mkdir(AUTH_DIR, { recursive: true });

  // Determine which browsers need auth
  const envBrowser = process.env.PW_BROWSER;
  const browsersToSetup: string[] = envBrowser
    ? [envBrowser]                          // CI: only the matrix browser
    : [...BROWSERS];                         // Local: all 3 browsers

  for (const browserName of browsersToSetup) {
    await loginAndSaveState(baseURL, browserName);
  }
}

export default globalSetup;
