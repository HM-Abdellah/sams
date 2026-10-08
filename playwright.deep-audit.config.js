import { defineConfig } from '@playwright/test'
import base from './playwright.config.js'

export default defineConfig({
  ...base,
  outputDir: 'artifacts/deep-audit/test-results',
  reporter: [
    ['html', { outputFolder: 'artifacts/deep-audit/playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    ...base.use,
    trace: 'on',
    screenshot: 'on',
    video: 'retain-on-failure',
  },
  workers: 1,
  fullyParallel: false,
})

