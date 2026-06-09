/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createWebConfig } from '@salesforce/playwright-vscode-ext';
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  ...createWebConfig({ testDir: './specs', timeout: 360_000 }),
  testIgnore: ['**/*.desktop.spec.ts']
};

export default config;
