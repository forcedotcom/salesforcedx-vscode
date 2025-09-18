/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { defineConfig, devices } from '@playwright/test';

/** Headless Playwright configuration for CI/local runs (no CDP/devtools). */
export default defineConfig({
  testDir: './test/web/headless',
  fullyParallel: !process.env.DEBUG_MODE,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI || process.env.DEBUG_MODE ? { workers: 1 } : {}),
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['line'], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['html', { open: 'never' }], ['list']],
  use: {
    viewport: { width: 1920, height: 1080 },
    baseURL: 'http://localhost:3001',
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    screenshot: process.env.CI ? 'on' : 'only-on-failure',
    video: process.env.CI ? 'on' : 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    launchOptions: {
      headless: process.env.DEBUG_MODE ? false : true,
      devtools: !!process.env.DEBUG_MODE,
      args: [
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-features=IsolateOrigins,site-per-process'
      ]
    }
  },
  timeout: process.env.DEBUG_MODE ? 0 : 60 * 1000,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'node out/test/web/headless-server.js',
    url: 'http://localhost:3001',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI
  }
});
