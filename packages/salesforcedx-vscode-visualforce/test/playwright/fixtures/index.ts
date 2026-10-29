/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test as webTest } from '@playwright/test';
import { containerTest } from './containerFixtures';
import { desktopTest } from './desktopFixtures';

const isDesktop = process.env.VSCODE_DESKTOP === '1';
const isContainer = process.env.VSCODE_CONTAINER === '1';

// Keep the browser open on failure when debugging web runs.
webTest.afterEach(async ({ page }, testInfo) => {
  if (process.env.DEBUG_MODE && testInfo.status !== 'passed') {
    await page.pause();
  }
});

// `.headless.spec.ts` files run on desktop, web, AND container; the desktop config sets
// VSCODE_DESKTOP, the container config sets VSCODE_CONTAINER, web sets neither.
export const test = isDesktop ? desktopTest : isContainer ? containerTest : webTest;
