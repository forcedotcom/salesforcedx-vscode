/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { defineConfig } from '@playwright/test';
import { createWebConfig } from '@salesforce/playwright-vscode-ext';

const baseConfig = createWebConfig();
const chromiumProject = baseConfig.projects?.[0];

// All LWC tests share a single VS Code web instance — they must run sequentially.
export default defineConfig({
  ...baseConfig,
  workers: 1,
  projects: chromiumProject
    ? [{ ...chromiumProject, fullyParallel: false, retries: 0 }]
    : []
});
