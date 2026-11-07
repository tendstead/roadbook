import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  workers: 1,
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:8082',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' }
    }
  ]
});
