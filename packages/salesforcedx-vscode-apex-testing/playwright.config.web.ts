/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import { createWebConfig } from '@salesforce/playwright-vscode-ext';

// Apex test runner has single execution queue per workspace — parallel workers collide ("already in execution queue")
// Apex test execution + deploy can be slow; extend timeout to 8 min
export default createWebConfig({ workers: 1, fullyParallel: false, timeout: 480_000 });
