/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  createDesktopTest,
  DREAMHOUSE_ORG_ALIAS,
  MINIMAL_ORG_ALIAS,
  NON_TRACKING_ORG_ALIAS
} from '@salesforce/playwright-vscode-ext';

export const test = createDesktopTest({ fixturesDir: __dirname, orgAlias: MINIMAL_ORG_ALIAS });
export const dreamhouseTest = createDesktopTest({ fixturesDir: __dirname, orgAlias: DREAMHOUSE_ORG_ALIAS });
export const nonTrackingTest = createDesktopTest({ fixturesDir: __dirname, orgAlias: NON_TRACKING_ORG_ALIAS });

// Keep VS Code window open on test failure when in debug mode
test.afterEach(async ({ page }, testInfo) => {
  if (process.env.DEBUG_MODE && testInfo.status !== 'passed') {
    console.log('\n🔍 DEBUG_MODE: Test failed - pausing to keep VS Code window open.');
    console.log('Press Resume in Playwright Inspector or close VS Code window to continue.');
    await page.pause();
  }
});
