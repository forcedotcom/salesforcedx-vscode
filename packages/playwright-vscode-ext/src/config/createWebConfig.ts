/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { defineConfig, devices } from '@playwright/test';

type WebConfigOptions = {
  /** Test directory relative to the config file (e.g. './specs') */
  testDir: string;
  /** Number of parallel workers (default: unset) */
  workers?: number;
  /** Run tests in parallel (default: true) */
  fullyParallel?: boolean;
  /** Per-test timeout in ms (default: 360_000) */
  timeout?: number;
};

/** Creates a standardized Playwright web config for VS Code extension testing */
export const createWebConfig = (options: WebConfigOptions) =>
  defineConfig({
    testDir: options.testDir,
    fullyParallel: options.fullyParallel ?? true,
    forbidOnly: !!process.env.CI,
    ...(options.workers ? { workers: options.workers } : {}),
    reporter: process.env.CI
      ? [['html', { open: 'never' }], ['line'], ['junit', { outputFile: 'test-results/junit.xml' }]]
      : [['html', { open: 'never' }], ['list']],
    use: {
      viewport: { width: 1920, height: 1080 },
      baseURL: 'http://localhost:3001',
      trace: process.env.CI ? 'on' : 'on-first-retry',
      screenshot: process.env.CI ? 'on' : 'only-on-failure',
      video: process.env.CI ? 'on' : 'retain-on-failure',
      actionTimeout: 15_000,
      navigationTimeout: 30_000,
      permissions: ['clipboard-read', 'clipboard-write'],
      launchOptions: {
        args: [
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-features=IsolateOrigins,site-per-process',
          '--enable-clipboard-read-write'
        ]
      }
    },
    timeout: process.env.DEBUG_MODE ? 0 : (options.timeout ?? 360 * 1000),
    maxFailures: process.env.CI ? 3 : 0,
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
        // E2E_NO_RETRIES: workflow try-run sets this env var to fail fast on cache miss (missing org/chromium).
        // Using env var instead of CLI arg preserves wireit cache key. See workflow comments for details.
        retries: process.env.E2E_NO_RETRIES ? 0 : 2,
        snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/chromium/{arg}{ext}'
      }
    ],
    webServer: {
      command: 'tsx web/headlessServer.ts',
      url: 'http://localhost:3001',
      timeout: 120 * 1000,
      // CI: always spawn headlessServer so runs are isolated. Local (`reuseExistingServer: !process.env.CI`): if 3001
      // is already up (stale headlessServer), reuse it instead of failing with "already used". For a guaranteed fresh
      // server locally, free the port or run with `CI=true`. Reusing a different app on 3001 (e.g. interactive run:web)
      // may cause EPIPE or flakes.
      reuseExistingServer: !process.env.CI
    }
  });
