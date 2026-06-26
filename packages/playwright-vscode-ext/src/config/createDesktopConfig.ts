/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { defineConfig } from '@playwright/test';

type DesktopConfigOptions = {
  /** Test directory relative to the config file (e.g. './specs') */
  testDir: string;
  /** Number of parallel workers (default: unset) */
  workers?: number;
  /** Run tests in parallel (default: true) */
  fullyParallel?: boolean;
  /** Per-test timeout in ms (default: 60_000) */
  timeout?: number;
};

/** Creates a standardized Playwright desktop (Electron) config for VS Code extension testing */
export const createDesktopConfig = (options: DesktopConfigOptions) => {
  const workers =
    options.workers ?? (process.env.PLAYWRIGHT_WORKERS ? parseInt(process.env.PLAYWRIGHT_WORKERS, 10) : undefined);
  return defineConfig({
    testDir: options.testDir,
    fullyParallel: options.fullyParallel ?? true,
    forbidOnly: !!process.env.CI,
    ...(workers ? { workers } : {}),
    reporter: process.env.CI
      ? [['html', { open: 'never' }], ['line'], ['junit', { outputFile: 'test-results/junit-desktop.xml' }]]
      : [['html', { open: 'never' }], ['list']],
    use: {
      trace: 'on',
      screenshot: 'on',
      // win32 desktop launch/file-handle contention makes individual actions slower; give them more room.
      actionTimeout: process.platform === 'win32' ? 20_000 : 15_000,
      viewport: { width: 1920, height: 1080 }
    },
    // win32 desktop electron launch + workbench-ready is slower (file-handle contention); raise the
    // test-level budget so the page fixture's own setup budget plus the test body both fit.
    // A caller-supplied options.timeout always wins (the ?? short-circuits before the win32 ternary).
    // Use process.platform (not isWindowsDesktop()) — VSCODE_DESKTOP is a job env var, not guaranteed
    // at config-load time; process.platform is the reliable signal in the config module.
    timeout: process.env.DEBUG_MODE ? 0 : (options.timeout ?? (process.platform === 'win32' ? 120_000 : 60_000)),
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
};
