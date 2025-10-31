/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { defineConfig, devices } from '@playwright/test';

/** Web Playwright configuration for CI/local runs */
export default defineConfig({
  testDir: './test/playwright/specs',
  fullyParallel: !process.env.CI,
  forbidOnly: !!process.env.CI,
  ...(process.env.CI ? { workers: 1 } : {}),
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
      use: { ...devices['Desktop Chrome'] },
      retries: 2,
      snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/chromium/{arg}{ext}'
    }
  ],
  webServer: {
    command: 'node out/test/playwright/web/headlessServer.js',
    url: 'http://localhost:3001',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI
  }
});
