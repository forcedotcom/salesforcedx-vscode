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
  emptyWorkspaceDesktopTest,
  nonTrackingDesktopTest,
  projectTargetDesktopTest,
  trackingConflictTest as trackingConflictDesktopTest
} from './desktopFixtures';
import { webTrackingConflictTest } from './webConflictFixtures';
import { containerTest, containerWorkspaceTest, projectTargetContainerTest } from './containerFixtures';

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
export const nonTrackingTest = isDesktop ? nonTrackingDesktopTest : webTest;
export const trackingConflictTest = isDesktop ? trackingConflictDesktopTest : webTrackingConflictTest;
export { desktopTest } from './desktopFixtures';

/** For specs unified across desktop, web, and the Code Builder container. */
export const sharedTest = isContainer ? containerTest : isDesktop ? desktopTest : webTest;
export const sharedDreamhouseTest = isContainer ? containerTest : isDesktop ? dreamhouseDesktopTest : webTest;
export const sharedNonTrackingTest = isContainer ? containerTest : isDesktop ? nonTrackingDesktopTest : webTest;
/** No SFDX project open: desktop's empty temp workspace, or the container's no-project phase. */
export const sharedEmptyWorkspaceTest = isContainer ? containerTest : isDesktop ? emptyWorkspaceDesktopTest : webTest;
/** Create Project specs: desktop scaffolds beside its temp workspace, the container into the no-project mount's scratch/. */
export const sharedProjectTargetTest = isContainer ? projectTargetContainerTest : projectTargetDesktopTest;
/**
 * Like `sharedTest`, but both sides provide `workspaceDir`: desktop's temp workspace, or the host side
 * of the container's fixture bind mount. For shared specs that read or write workspace files.
 */
export const sharedWorkspaceDirTest = isContainer ? containerWorkspaceTest : desktopTest;
