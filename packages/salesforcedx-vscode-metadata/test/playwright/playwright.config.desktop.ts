/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createDesktopConfig } from '@salesforce/playwright-vscode-ext';
import { defineConfig } from '@playwright/test';

const baseConfig = createDesktopConfig();

export default defineConfig({
  ...baseConfig,
  projects: [
    {
      name: 'parallel',
      testDir: './specs'
    },
    {
      name: 'conflicts',
      testDir: './specs-conflicts',
      workers: 1,
      fullyParallel: false,
      timeout: 120_000
    }
  ]
});
