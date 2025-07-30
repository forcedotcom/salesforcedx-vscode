/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for testing VS Code web extensions
 * Uses vscode-test-web to serve VS Code in browser with our extensions loaded
 * Now with CDP (Chrome DevTools Protocol) support for real console access
 */
export default defineConfig({
  testDir: './test/web',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }], // Don't auto-open HTML report
    ['list'] // Also show list output for immediate feedback
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'on',
    video: 'on',
    actionTimeout: 10000,
    navigationTimeout: 30000,
    launchOptions: {
      args: [
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--allow-running-insecure-content',
        '--disable-site-isolation-trials',
        '--remote-debugging-port=9222', // Enable CDP access like manual test
        '--no-first-run',
        '--no-default-browser-check'
      ],
      devtools: true // Open DevTools like manual test
    }
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],

  webServer: {
    command: 'npm run start:web:test',
    url: 'http://localhost:3000',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI
  }
});
