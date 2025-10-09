/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { defineConfig } from '@playwright/test';

/** Desktop Playwright configuration for Electron-based VS Code tests */
export default defineConfig({
  testDir: './test/playwright/specs',
  fullyParallel: !process.env.CI,
  forbidOnly: !!process.env.CI,
  ...(process.env.CI ? { workers: 1 } : {}), // Parallel locally (isolated user-data-dir), sequential in CI for stability
  reporter: process.env.CI
    ? [['html', { open: 'never' }], ['line'], ['junit', { outputFile: 'test-results/junit-desktop.xml' }]]
    : [['html', { open: 'never' }], ['list']],
  use: {
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    screenshot: process.env.CI ? 'on' : 'only-on-failure',
    video: process.env.CI ? 'on' : 'retain-on-failure',
    actionTimeout: 15000,
    viewport: { width: 1920, height: 1080 }
  },
  timeout: process.env.DEBUG_MODE ? 0 : 60 * 1000,
  projects: [
    {
      name: 'desktop-electron',
      retries: process.env.CI ? 2 : 0, // No retries locally for faster feedback,
      snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/desktop-electron/{arg}{ext}'
    }
  ]
});
