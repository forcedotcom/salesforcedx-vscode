/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test as webTest } from '@playwright/test';
import { desktopTest, dreamhouseDesktopTest, nonTrackingDesktopTest } from './desktopFixtures';

const isDesktop = process.env.VSCODE_DESKTOP === '1';

// Keep browser open on test failure when in debug mode
webTest.afterEach(async ({ page }, testInfo) => {
  if (process.env.DEBUG_MODE && testInfo.status !== 'passed') {
    console.log('\n🔍 DEBUG_MODE: Test failed - pausing to keep browser open.');
    console.log('Press Resume in Playwright Inspector or close browser to continue.');
    await page.pause();
  }
});

// Export the appropriate test based on environment (fixtures differ)
// expect is the same for both, so just re-export it directly
export const test = isDesktop ? desktopTest : webTest;
export const dreamhouseTest = isDesktop ? dreamhouseDesktopTest : webTest;
export const nonTrackingTest = isDesktop ? nonTrackingDesktopTest : webTest;
