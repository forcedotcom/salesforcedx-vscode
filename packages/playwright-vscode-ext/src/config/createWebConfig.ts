/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { defineConfig, devices } from '@playwright/test';

type WebConfigOptions = {
  /** Test directory relative to extension root (default: './test/playwright/specs') */
  testDir?: string;
  /** Number of parallel workers (default: unset unless E2E_SEQUENTIAL) */
  workers?: number;
  /** Run tests in parallel (default: !E2E_SEQUENTIAL) */
  fullyParallel?: boolean;
  /** Per-test timeout in ms (default: 360_000) */
  timeout?: number;
};

/** Creates a standardized Playwright web config for VS Code extension testing */
export const createWebConfig = (options: WebConfigOptions = {}) =>
  defineConfig({
    testDir: options.testDir ?? './test/playwright/specs',
    fullyParallel: options.fullyParallel ?? !process.env.E2E_SEQUENTIAL,
    forbidOnly: !!process.env.CI,
    ...(options.workers ? { workers: options.workers } : process.env.E2E_SEQUENTIAL ? { workers: 1 } : {}),
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
    timeout: process.env.DEBUG_MODE ? 0 : options.timeout ?? 360 * 1000,
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
      command: 'node out/test/playwright/web/headlessServer.js',
      url: 'http://localhost:3001',
      timeout: 300 * 1000,
      // Always start fresh. Reusing run:web (port 3001) causes EPIPE/premature close when test process
      // expects to control the server lifecycle.
      reuseExistingServer: false
    }
  });
