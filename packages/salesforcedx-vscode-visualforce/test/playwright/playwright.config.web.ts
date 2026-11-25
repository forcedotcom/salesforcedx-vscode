/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { defineConfig } from '@playwright/test';
import { createWebConfig } from '@salesforce/playwright-vscode-ext';

const config = createWebConfig({ testDir: './specs' });

export default defineConfig({
  ...config,
  testIgnore: ['**/*.desktop.spec.ts'],
  projects: config.projects?.map(project => ({
    ...project,
    // Desktop Chrome's device preset otherwise overrides the shared 1920×1080 viewport.
    use: { ...project.use, viewport: config.use?.viewport }
  })),
  use: {
    ...config.use,
    video: 'off',
    // Trace screencasts start before setup and would constrain the flow video's resolution.
    trace: { mode: process.env.CI ? 'on' : 'on-first-retry', screenshots: false }
  }
});
