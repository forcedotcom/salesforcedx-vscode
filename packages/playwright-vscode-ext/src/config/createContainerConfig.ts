/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { defineConfig, devices } from '@playwright/test';

type ContainerConfigOptions = {
  /** Test directory relative to the config file (e.g. './specs') */
  testDir: string;
  /** Number of parallel workers (default: 1 — one shared container serves the workbench) */
  workers?: number;
  /** Run tests in parallel (default: false — the container is a single shared editor session) */
  fullyParallel?: boolean;
  /** Per-test timeout in ms (default: 360_000) */
  timeout?: number;
};

/**
 * Playwright config for driving a browser against a running Code Builder container.
 *
 * Code Builder serves a Node-extension-host code-server over a browser UI, so the client is a
 * plain Chromium page navigating to the container URL (like web mode) while the workbench runs the
 * desktop extension build. The container is started, extension-swapped, and health-checked by the
 * workflow — there is no Playwright `webServer` here. `CODE_BUILDER_URL` overrides the default port
 * (58080 published to 8123 in CI).
 */
export const createContainerConfig = (options: ContainerConfigOptions) =>
  defineConfig({
    testDir: options.testDir,
    fullyParallel: options.fullyParallel ?? false,
    forbidOnly: !!process.env.CI,
    workers: options.workers ?? 1,
    reporter: process.env.CI
      ? [['html', { open: 'never' }], ['line'], ['junit', { outputFile: 'test-results/junit.xml' }]]
      : [['html', { open: 'never' }], ['list']],
    use: {
      viewport: { width: 1920, height: 1080 },
      baseURL: process.env.CODE_BUILDER_URL ?? 'http://localhost:8123',
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
        retries: process.env.E2E_NO_RETRIES ? 0 : 2,
        snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/chromium/{arg}{ext}'
      }
    ]
  });
