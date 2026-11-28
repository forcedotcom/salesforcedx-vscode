/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { defineConfig } from '@playwright/test';
import { createWebConfig } from '@salesforce/playwright-vscode-ext';

const webConfig = createWebConfig({ testDir: './specs' });

export default defineConfig({
  ...webConfig,
  use: { ...webConfig.use, video: 'off' },
  testIgnore: ['**/*.container.spec.ts', '**/*.desktop.spec.ts']
});
