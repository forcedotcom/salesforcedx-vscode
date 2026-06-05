/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopConfig } from '@salesforce/playwright-vscode-ext';

// jorje LSP is single-process; restart specs share workspace state. Force serial.
export default createDesktopConfig({ testDir: './specs', workers: 1, fullyParallel: false, timeout: 360_000 });
