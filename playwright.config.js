import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: true,

  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.SAMS_BASE_URL || 'http://localhost:5173/',
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off'
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: ['**/*.mobile.spec.js'],
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'mobile',
      testMatch: ['**/*.mobile.spec.js'],
      use: { ...devices['Pixel 5'] }
    }
  ]
});
