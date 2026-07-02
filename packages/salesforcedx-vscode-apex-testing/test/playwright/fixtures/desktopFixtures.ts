/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopTest, LOGOUT_TEST_ORG_ALIAS, NON_TRACKING_ORG_ALIAS } from '@salesforce/playwright-vscode-ext';

// Apex-testing specs never run Push/Pull or rely on source tracking, so they use a non-tracking
// org. This avoids the "Override Conflicts and Deploy" modal that source-tracked orgs surface
// on rerun when remote tracking state diverges from local.
export const desktopTest = createDesktopTest({
  fixturesDir: __dirname,
  orgAlias: NON_TRACKING_ORG_ALIAS,
  additionalExtensionDirs: [
    'salesforcedx-vscode-core',
    'salesforcedx-vscode-org',
    'salesforcedx-vscode-metadata',
    'salesforcedx-vscode-apex-log',
    'salesforcedx-vscode-apex'
  ],
  disableOtherExtensions: false,
  userSettings: {
    'git.terminalAuthentication': false,
    'git.autofetch': false,
    // Render `showWarningMessage({ modal: true })` (e.g. the scratch-org logout confirm) as an
    // in-DOM dialog so Playwright can click its button; native OS dialogs are not reachable.
    'window.dialogStyle': 'custom'
  }
});

// Same as `desktopTest` but defaults the workspace to the DEDICATED logout-test org. The clear-on-logout
// spec logs out of its default org; pointing it at LOGOUT_TEST_ORG_ALIAS (matched by setupLogoutTestOrgAndAuth)
// keeps it from destroying the shared NON_TRACKING_ORG_ALIAS other specs reuse.
export const logoutDesktopTest = createDesktopTest({
  fixturesDir: __dirname,
  orgAlias: LOGOUT_TEST_ORG_ALIAS,
  additionalExtensionDirs: [
    'salesforcedx-vscode-core',
    'salesforcedx-vscode-org',
    'salesforcedx-vscode-metadata',
    'salesforcedx-vscode-apex-log',
    'salesforcedx-vscode-apex'
  ],
  disableOtherExtensions: false,
  userSettings: {
    'git.terminalAuthentication': false,
    'git.autofetch': false,
    'window.dialogStyle': 'custom'
  }
});

export const noOrgDesktopTest = createDesktopTest({
  fixturesDir: __dirname,
  additionalExtensionDirs: [
    'salesforcedx-vscode-core',
    'salesforcedx-vscode-metadata',
    'salesforcedx-vscode-apex-log',
    'salesforcedx-vscode-apex'
  ],
  disableOtherExtensions: false,
  userSettings: {
    'git.terminalAuthentication': false,
    'git.autofetch': false
  }
});

export const emptyWorkspaceDesktopTest = createDesktopTest({
  fixturesDir: __dirname,
  emptyWorkspace: true,
  additionalExtensionDirs: [
    'salesforcedx-vscode-core',
    'salesforcedx-vscode-metadata',
    'salesforcedx-vscode-apex-log',
    'salesforcedx-vscode-apex'
  ],
  disableOtherExtensions: false,
  userSettings: {
    'git.terminalAuthentication': false,
    'git.autofetch': false
  }
});
