/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test as webTest } from '@playwright/test';
import {
  desktopTest,
  dreamhouseDesktopTest,
  nonTrackingDesktopTest,
  trackingConflictTest as trackingConflictDesktopTest
} from './desktopFixtures';
import { webTrackingConflictTest } from './webConflictFixtures';

const isDesktop = process.env.VSCODE_DESKTOP === '1';

// Export the appropriate test based on environment (fixtures differ)
// expect is the same for both, so just re-export it directly
export const test = isDesktop ? desktopTest : webTest;
export const dreamhouseTest = isDesktop ? dreamhouseDesktopTest : webTest;
export const nonTrackingTest = isDesktop ? nonTrackingDesktopTest : webTest;
export const trackingConflictTest = isDesktop ? trackingConflictDesktopTest : webTrackingConflictTest;
export { emptyWorkspaceDesktopTest } from './desktopFixtures';
