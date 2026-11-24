import { defineConfig, devices } from '@playwright/test';

/**
 * E2E suite for the study groups program. It runs against the local Docker stack (`kool start`) from the official
 * Playwright image, which shares the app container's network (see `e2e/run.sh`), so `localhost:3000` is the app.
 * Files run in name order on one worker: they share one database that `e2e/run.sh` resets before each run.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
