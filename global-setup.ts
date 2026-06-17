/**
 * Global Setup — Playwright
 *
 * Logs in ONCE as standard_user, saves cookies + localStorage to
 * .auth/standard_user.json. Every project then injects this state
 * via storageState, eliminating 80+ login operations per CI run.
 *
 * Browser-agnostic: tries chromium first (fastest), then firefox,
 * then webkit. The storageState JSON is identical across browsers,
 * so whichever browser creates it is irrelevant — all projects
 * consume the same file. This avoids crashes in CI matrix jobs
 * that only install a single browser (e.g. webkit-only).
 *
 * Usage: added to playwright configs under globalSetup.
 */
import {
  chromium,
  firefox,
  webkit,
  type FullConfig,
  type BrowserType,
  type Browser,
} from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const AUTH_DIR  = path.resolve(import.meta.dirname ?? __dirname, '.auth');
const AUTH_FILE = path.join(AUTH_DIR, 'standard_user.json');

// ── Browser priority: chromium → firefox → webkit ──────────────
const BROWSERS: Array<{ name: string; type: BrowserType<Record<string, never>> }> = [
  { name: 'chromium', type: chromium },
  { name: 'firefox',  type: firefox },
  { name: 'webkit',   type: webkit },
];

async function launchFirstAvailable(): Promise<{
  browser: Browser;
  browserName: string;
}> {
  const errors: string[] = [];

  for (const { name, type } of BROWSERS) {
    try {
      const browser = await type.launch();
      console.log(`✓ Global setup: using ${name} for auth`);
      return { browser, browserName: name };
    } catch (err) {
      errors.push(`${name}: ${(err as Error).message.split('\n')[0]}`);
    }
  }

  throw new Error(
    `No Playwright browser available. Tried:\n${errors.map((e) => `  - ${e}`).join('\n')}\n` +
      'Run: npx playwright install',
  );
}

async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'https://www.saucedemo.com';

  // Ensure .auth directory exists
  await fs.promises.mkdir(AUTH_DIR, { recursive: true });

  const { browser } = await launchFirstAvailable();
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
