/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test as webTest } from '@playwright/test';

import { desktopTest } from './desktopFixtures';

const isDesktop = process.env.VSCODE_DESKTOP === '1';

// Keep browser open on test failure when in debug mode
webTest.afterEach(async ({ page }, testInfo) => {
  if (process.env.DEBUG_MODE && testInfo.status !== 'passed') {
    console.log('\n🔍 DEBUG_MODE: Test failed - pausing to keep browser open.');
    console.log('Press Resume in Playwright Inspector or close browser to continue.');
    await page.pause();
  }
});

export const test = isDesktop ? desktopTest : webTest;
