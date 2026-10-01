/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test as webTest } from '@playwright/test';

import { outlineDesktopTest } from './outlineFixtures';

const isDesktop = process.env.VSCODE_DESKTOP === '1';

// Desktop specs take `workspaceDir` from desktopTest. A ternary with the base Playwright test
// erases that fixture from the type. The outline spec is the one that runs on both targets.
export const outlineTest = isDesktop ? outlineDesktopTest : webTest;

export { desktopTest as test, snippetDesktopTest as snippetTest } from './desktopFixtures';
