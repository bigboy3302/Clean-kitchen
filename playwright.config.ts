import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  reporter: [['list']],
  workers: 1,
  timeout: 120_000,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    headless: true,                  // use --project=debug-chromium to watch live
    screenshot: 'only-on-failure',   // screenshots on failure
    video: 'retain-on-failure',      // video on failure
    trace: 'retain-on-failure',      // open with: npx playwright show-trace trace.zip
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npm run dev',
    url: process.env.BASE_URL || 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    // Normal headless run
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },

    // Debug project: headed + slow motion
    {
      name: 'debug-chromium',
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
        launchOptions: { slowMo: 250 }, // ms delay between actions
      },
    },
  ],
  // If you want to run only this file by default, uncomment:
  // testMatch: /e2e\.flow\.no-screens\.spec\.ts$/,
});
