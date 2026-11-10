/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { defineConfig } from '@playwright/test';
import { createDesktopConfig } from '@salesforce/playwright-vscode-ext';

const config = createDesktopConfig({ testDir: './specs' });

export default defineConfig({
  ...config,
  use: {
    ...config.use,
    // Keep trace actions/DOM snapshots without a competing pre-setup screencast.
    trace: { mode: 'on', screenshots: false }
  }
});
