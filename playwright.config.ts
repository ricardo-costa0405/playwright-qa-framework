/**
 * Main Playwright Configuration
 * 
 * Default configuration for all Playwright tests.
 * Uses the web configuration for desktop browser testing.
 * 
 * Usage:
 *   npx playwright test                    # Run all tests (uses web config)
 *   npx playwright test --grep @smoke      # Run smoke tests
 *   npx playwright test --config config/playwright.api.config.ts  # Run API tests
 */

import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from project root
dotenv.config({ path: path.resolve(__dirname, '.env') });

const BASE_URL        = process.env.BASE_URL    || 'https://www.saucedemo.com';
const TIMEOUT         = parseInt(process.env.TIMEOUT        || '30000');
const EXPECT_TIMEOUT  = parseInt(process.env.EXPECT_TIMEOUT || '10000');
const CI              = process.env.CI === 'true';

// Re-export the web configuration directly
export default defineConfig({
  testDir: './tests/web/specs',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 4 : undefined,
  reporter: [
    ...(CI ? [['github'] as ['github']] : []),
    ['junit', { outputFile: 'reports/junit/web-results.xml' }],
    ['html', { outputFolder: 'reports/html/web', open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL: BASE_URL,
    trace: CI ? 'retain-on-failure-and-retries' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 0,
    navigationTimeout: 0,
  },

  timeout: TIMEOUT,
  expect: {
    timeout: EXPECT_TIMEOUT,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'chromium-1366',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
    },
  ],
});
