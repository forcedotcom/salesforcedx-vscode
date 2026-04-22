/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import { createWebConfig } from '@salesforce/playwright-vscode-ext';

export default createWebConfig({ testDir: './specs', workers: 1, fullyParallel: false, timeout: 480_000 });
