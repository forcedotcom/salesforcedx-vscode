/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopConfig } from '@salesforce/playwright-vscode-ext';

// Specs mutate the shared minimal org's trace flags and debug levels; don't run them concurrently.
export default createDesktopConfig({ testDir: './specs', workers: 1 });
