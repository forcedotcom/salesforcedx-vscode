/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createWebConfig } from '@salesforce/playwright-vscode-ext';

// Trace flag tests share org state; always run sequentially
process.env.E2E_SEQUENTIAL = '1';

export default createWebConfig();
