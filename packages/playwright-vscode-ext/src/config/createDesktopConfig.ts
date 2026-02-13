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
};

/** Creates a standardized Playwright desktop (Electron) config for VS Code extension testing */
export const createDesktopConfig = (options: DesktopConfigOptions = {}) =>
  defineConfig({
    testDir: options.testDir ?? './test/playwright/specs',
    fullyParallel: !process.env.E2E_SEQUENTIAL,
    forbidOnly: !!process.env.CI,
    ...(process.env.E2E_SEQUENTIAL ? { workers: 1 } : {}), // Sequential when E2E_SEQUENTIAL=1 (used for retry step)
    reporter: process.env.CI
      ? [['html', { open: 'never' }], ['line'], ['junit', { outputFile: 'test-results/junit-desktop.xml' }]]
      : [['html', { open: 'never' }], ['list']],
    use: {
      trace: 'on',
      screenshot: 'on',
      actionTimeout: 15_000,
      viewport: { width: 1920, height: 1080 }
    },
    timeout: process.env.DEBUG_MODE ? 0 : 60 * 1000,
    maxFailures: process.env.CI ? 3 : 0,
    globalSetup: require.resolve('./downloadVSCode'),
    projects: [
      {
        name: 'desktop-electron',
        retries: process.env.CI ? 2 : 0, // No retries locally for faster feedback
        snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/desktop-{platform}/{arg}{ext}'
      }
    ]
  });
