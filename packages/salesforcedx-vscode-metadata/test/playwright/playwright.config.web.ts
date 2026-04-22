/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createWebConfig } from '@salesforce/playwright-vscode-ext';
import { defineConfig, devices } from '@playwright/test';

const base = createWebConfig({ testDir: './specs' });

export default defineConfig({
  ...base,
  projects: [
    { name: 'parallel', testDir: './specs', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'conflicts',
      testDir: './specs-conflicts/tracking',
      use: { ...devices['Desktop Chrome'] },
      workers: 1,
      fullyParallel: false
    }
  ]
});
