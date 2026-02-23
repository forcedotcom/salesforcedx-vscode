/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopTest, MINIMAL_ORG_ALIAS } from '@salesforce/playwright-vscode-ext';

export const desktopTest = createDesktopTest({
  fixturesDir: __dirname,
  orgAlias: MINIMAL_ORG_ALIAS,
  // some of the necessary configs are over there
  additionalExtensionDirs: ['salesforcedx-vscode-metadata']
});

export const createProjectTest = createDesktopTest({
  fixturesDir: __dirname,
  orgAlias: MINIMAL_ORG_ALIAS,
  additionalExtensionDirs: ['salesforcedx-vscode-metadata'],
  // use vscode's dialog box instead of the native OS, so playwright can interact with it
  userSettings: { 'files.simpleDialog.enable': true }
});
