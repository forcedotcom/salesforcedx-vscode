/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { defineConfig } from '@playwright/test';

type DesktopConfigOptions = {
  /** Test directory relative to extension root (default: './test/playwright/specs') */
  testDir?: string;
  /** Number of parallel workers (default: unset) */
  workers?: number;
  /** Run tests in parallel (default: true) */
  fullyParallel?: boolean;
  /** Per-test timeout in ms (default: 60_000) */
  timeout?: number;
};

/** Creates a standardized Playwright desktop (Electron) config for VS Code extension testing */
export const createDesktopConfig = (options: DesktopConfigOptions = {}) =>
  defineConfig({
    testDir: options.testDir ?? './test/playwright/specs',
    fullyParallel: options.fullyParallel ?? true,
    forbidOnly: !!process.env.CI,
    ...(options.workers ? { workers: options.workers } : {}),
    reporter: process.env.CI
      ? [['html', { open: 'never' }], ['line'], ['junit', { outputFile: 'test-results/junit-desktop.xml' }]]
      : [['html', { open: 'never' }], ['list']],
    use: {
      trace: 'on',
      screenshot: 'on',
      actionTimeout: 15_000,
      viewport: { width: 1920, height: 1080 }
    },
    timeout: process.env.DEBUG_MODE ? 0 : options.timeout ?? 60 * 1000,
    maxFailures: process.env.CI ? 3 : 0,
    globalSetup: require.resolve('./downloadVSCode'),
    projects: [
      {
        name: 'desktop-electron',
        // E2E_NO_RETRIES: workflow try-run sets this env var to fail fast on cache miss (missing org/chromium).
        // Using env var instead of CLI arg preserves wireit cache key. See workflow comments for details.
        retries: process.env.E2E_NO_RETRIES ? 0 : process.env.CI ? 2 : 0,
        snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/desktop-{platform}/{arg}{ext}'
      }
    ]
  });
