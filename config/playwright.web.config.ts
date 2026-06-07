import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Load .env from project root (one level up from config/)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BASE_URL        = process.env.BASE_URL    || 'https://www.saucedemo.com';
const TIMEOUT         = parseInt(process.env.TIMEOUT        || '30000');
const EXPECT_TIMEOUT  = parseInt(process.env.EXPECT_TIMEOUT || '10000');
const CI              = process.env.CI === 'true';
const TRACE_MODE      = process.env.PW_TRACE_MODE || 'retain-on-failure';

// Screencast dir — resolved from project root so it always lands in the right place
const SCREENCAST_DIR  = path.resolve(__dirname, '../reports/screencast-debug');

/**
 * Web Platform Configuration — Swag Labs (https://www.saucedemo.com)
 *
 * Profiles:
 *   chromium       — Desktop Chrome  1920×1080
 *   firefox        — Desktop Firefox 1920×1080
 *   webkit         — Desktop Safari  1920×1080
 *   chromium-1366  — Desktop Chrome  1366×768  (common laptop resolution)
 *
 * Screencast: every test is video-recorded, saved to reports/screencast-debug/<browser>/
 * Show results: npm run report:show
 * Show trace:   npm run report:trace <trace.zip>
 *
 * Anti-patterns guide: utils/patterns/anti-patterns-guide.ts
 */
export default defineConfig({
  testDir:   '../tests/web/specs',
  testMatch: '**/*.spec.ts',

  fullyParallel: true,
  forbidOnly:    CI,
  retries:       CI ? 2 : 0,
  workers:       CI ? 4 : undefined,

  reporter: [
    ...(CI ? [['github'] as ['github']] : []),
    ['junit', { outputFile: '../reports/junit/web-results.xml' }],
    ['html',  { outputFolder: '../reports/html/web', open: 'never' }],
    ['json',  { outputFile: '../reports/failures.json' }],
    ['list'],
  ],

  use: {
    baseURL:          BASE_URL,
    trace:            TRACE_MODE as 'on' | 'off' | 'retain-on-failure' | 'on-first-retry',
    screenshot:       'only-on-failure',
    actionTimeout:    0,   // rely on Playwright auto-waiting
    navigationTimeout: 0,  // let assertions drive readiness checks

    // ── Screencast / annotated videos (Playwright 1.59) ───────────────────
    video: {
      mode: 'on',
      show: {
        actions: { position: 'top-right' },
      },
    },
  },

  timeout: TIMEOUT,
  expect:  { timeout: EXPECT_TIMEOUT },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport:    { width: 1920, height: 1080 },
        launchOptions: { args: ['--disable-dev-shm-usage'] },
      },
      outputDir: `${SCREENCAST_DIR}/chromium`,
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 },
      },
      outputDir: `${SCREENCAST_DIR}/firefox`,
    },

    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 },
      },
      outputDir: `${SCREENCAST_DIR}/webkit`,
    },

    {
      name: 'chromium-1366',
      use: {
        ...devices['Desktop Chrome'],
        viewport:    { width: 1366, height: 768 },
        launchOptions: { args: ['--disable-dev-shm-usage'] },
      },
      outputDir: `${SCREENCAST_DIR}/chromium-1366`,
    },
  ],
});
