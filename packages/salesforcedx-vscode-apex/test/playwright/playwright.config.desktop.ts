/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopConfig } from '@salesforce/playwright-vscode-ext';
import type { PlaywrightTestConfig } from '@playwright/test';

// jorje LSP is single-process and the restart specs are heavy; run one at a time (workers: 1, not parallel).
const config: PlaywrightTestConfig = {
  ...createDesktopConfig({ testDir: './specs', workers: 1, fullyParallel: false, timeout: 360_000 }),
  testIgnore: ['**/*.headless.spec.ts']
};

export default config;
