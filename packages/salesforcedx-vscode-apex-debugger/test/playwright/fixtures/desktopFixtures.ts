/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopTest, MINIMAL_ORG_ALIAS } from '@salesforce/playwright-vscode-ext';

// apex-debugger declares services as an extensionDependency; load it alongside the extension under test.
const additionalExtensionDirs = ['salesforcedx-vscode-services'];

/** `sfdx-project.json` workspace with the minimal scratch org set as default (`.sfdx/config.json` target-org)
 * so `ConnectionService.getConnection()` resolves for the debuggerStop query. */
export const debuggerDesktopTest = createDesktopTest({
  fixturesDir: __dirname,
  additionalExtensionDirs,
  orgAlias: MINIMAL_ORG_ALIAS
});

/** Empty workspace (no `sfdx-project.json`); `files.simpleDialog.enable` routes the ISV bootstrap folder
 * picker through VS Code's DOM instead of the inaccessible native OS dialog. */
export const debuggerEmptyWorkspaceDesktopTest = createDesktopTest({
  fixturesDir: __dirname,
  additionalExtensionDirs,
  emptyWorkspace: true,
  userSettings: {
    'files.simpleDialog.enable': true
  }
});
