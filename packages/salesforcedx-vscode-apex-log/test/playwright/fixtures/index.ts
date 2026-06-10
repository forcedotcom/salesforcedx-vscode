/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test as webTest } from '@playwright/test';

import { desktopTest, emptyWorkspaceDesktopTest, multiPackageNoOrgDesktopTest, noOrgDesktopTest } from './desktopFixtures';

const isDesktop = process.env.VSCODE_DESKTOP === '1';

export const test = isDesktop ? desktopTest : webTest;
export const emptyWorkspaceTest = isDesktop ? emptyWorkspaceDesktopTest : webTest;
export const noOrgTest = isDesktop ? noOrgDesktopTest : webTest;
export const multiPackageNoOrgTest = isDesktop ? multiPackageNoOrgDesktopTest : webTest;
