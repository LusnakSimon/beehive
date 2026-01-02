// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for eBeeHive E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['list']
  ],
  /* Global timeout for each test */
  timeout: 30000,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.E2E_BASE_URL || 'https://ebeehive.vercel.app',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Video on failure */
    video: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    // Desktop Chrome - uses auth from login-helper.js
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Use stored auth state (run login-helper.js first if needed)
        storageState: './playwright/.auth/user.json',
      },
    },
    
    // Mobile Chrome
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        storageState: './playwright/.auth/user.json',
      },
    },
    
    // Tests that don't need auth
    {
      name: 'no-auth',
      testMatch: /login\.spec\.js/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
