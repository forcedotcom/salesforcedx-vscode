/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopTest } from 'salesforcedx-vscode-playwright';

export const test = createDesktopTest({ fixturesDir: __dirname });

// Keep VS Code window open on test failure when in debug mode
test.afterEach(async ({ page }, testInfo) => {
  if (process.env.DEBUG_MODE && testInfo.status !== 'passed') {
    console.log('\n🔍 DEBUG_MODE: Test failed - pausing to keep VS Code window open.');
    console.log('Press Resume in Playwright Inspector or close VS Code window to continue.');
    await page.pause();
  }
});
