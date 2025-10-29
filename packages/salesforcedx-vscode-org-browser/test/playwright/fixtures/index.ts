/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test as webTest } from '@playwright/test';
import { test as desktopTest } from './desktopFixtures';

export const isDesktop = process.env.VSCODE_DESKTOP === '1';

// Export the appropriate test based on environment (fixtures differ)
// expect is the same for both, so just re-export it directly
export const test = isDesktop ? desktopTest : webTest;
