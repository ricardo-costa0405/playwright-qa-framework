import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BASE_URL       = process.env.BASE_URL    || 'https://www.saucedemo.com';
const TIMEOUT        = parseInt(process.env.TIMEOUT        || '30000');
const EXPECT_TIMEOUT = parseInt(process.env.EXPECT_TIMEOUT || '10000');
const CI             = process.env.CI === 'true';
const isLocalhost    = BASE_URL.includes('localhost');
const TRACE_MODE     = process.env.PW_TRACE_MODE || 'retain-on-failure';

/**
 * Web Mobile Platform Configuration
 * Mobile device emulation: Pixel 5, iPhone 13 Pro, Galaxy S21
 * Touch support and mobile-specific viewports
 */
export default defineConfig({
  globalSetup:   '../global-setup.ts',
  testDir:      '../tests/web-mobile/specs',
  testMatch:    '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly:   CI,
  retries:      CI ? 2 : 0,
  workers:      CI ? 4 : undefined,

  reporter: [
    ...(CI ? [['github'] as ['github']] : []),
    ['junit', { outputFile: '../reports/junit/web-mobile-results.xml' }],
    ['html',  { outputFolder: '../reports/html/web-mobile', open: 'never' }],
    ['json',  { outputFile: '../reports/failures.json' }],
    ['list'],
  ],

  use: {
    baseURL:           BASE_URL,
    storageState:      '../.auth/standard_user.json',
    trace:             TRACE_MODE as 'on' | 'off' | 'retain-on-failure' | 'on-first-retry',
    screenshot:        'only-on-failure',
    video: {
      mode: 'retain-on-failure',
      show: {
        actions: { position: 'top-right' },
      },
    },
    actionTimeout:     0,
    navigationTimeout: 0,
  },

  timeout: TIMEOUT,
  expect:  { timeout: EXPECT_TIMEOUT },

  webServer: isLocalhost
    ? { command: 'npm run dev', url: BASE_URL, reuseExistingServer: !CI }
    : undefined,

  projects: [
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13 Pro'] },
    },
    {
      name: 'Galaxy S24',
      use: { ...devices['Galaxy S24'] },
    },
  ],
});
