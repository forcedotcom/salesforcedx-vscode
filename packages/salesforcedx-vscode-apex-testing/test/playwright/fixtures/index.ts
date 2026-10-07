/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test as webTest } from '@playwright/test';

import { desktopTest, emptyWorkspaceDesktopTest, noOrgDesktopTest, trackingDesktopTest } from './desktopFixtures';
import { containerTest } from './containerFixtures';

const isDesktop = process.env.VSCODE_DESKTOP === '1';
export const isContainer = process.env.VSCODE_CONTAINER === '1';

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

// Shared variants additionally route through the container fixture when running inside Code
// Builder (VSCODE_CONTAINER=1). The three-way ternary is mandatory: falling back to
// `isDesktop ? X : webTest` (rather than just `X`) keeps a plain `npm run test:web` run (neither
// VSCODE_DESKTOP nor VSCODE_CONTAINER set) on the plain-browser webTest fixture instead of
// accidentally launching Electron via the desktop fixture.
export const sharedTest = isContainer ? containerTest : isDesktop ? desktopTest : webTest;
export const sharedTrackingTest = isContainer ? containerTest : isDesktop ? trackingDesktopTest : webTest;
export const sharedNoOrgTest = isContainer ? containerTest : isDesktop ? noOrgDesktopTest : webTest;
export const sharedEmptyWorkspaceTest = isContainer ? containerTest : isDesktop ? emptyWorkspaceDesktopTest : webTest;
