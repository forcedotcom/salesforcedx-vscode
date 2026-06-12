/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createDesktopConfig } from '@salesforce/playwright-vscode-ext';

// Serialize: all 7 specs share a single MINIMAL_ORG_ALIAS scratch org; parallel workers cause source-tracking conflicts.
export default createDesktopConfig({ testDir: './specs', workers: 1 });
