/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopTest, MINIMAL_ORG_ALIAS } from '@salesforce/playwright-vscode-ext';

/** `sfdx-project.json` workspace, no `.sfdx/config.json` — palette assertions do not need a real org */
export const orgDesktopTest = createDesktopTest({
  fixturesDir: __dirname,
  additionalExtensionDirs: ['salesforcedx-vscode-core']
});

/** Same workspace with the minimal scratch org set as default (`.sfdx/config.json` target-org),
 * so default-org context keys (e.g. `sf:default_org_deletable`) are populated. */
export const orgDesktopMinimalDefaultTest = createDesktopTest({
  fixturesDir: __dirname,
  additionalExtensionDirs: ['salesforcedx-vscode-core'],
  orgAlias: MINIMAL_ORG_ALIAS
});

/** `sfdx-project.json` workspace, no seeded default org. `window.dialogStyle: custom` routes
 * `showWarningMessage({ modal: true })` through VS Code's DOM (.monaco-dialog-box) so Playwright can
 * click the scratch-org logout confirm button; native Electron dialogs are inaccessible. The test
 * creates its own default scratch org through the extension so logout never destroys a shared org. */
export const orgDesktopLogoutTest = createDesktopTest({
  fixturesDir: __dirname,
  additionalExtensionDirs: ['salesforcedx-vscode-core'],
  userSettings: {
    'window.dialogStyle': 'custom'
  }
});

/** Minimal-scratch-default fixture that also routes `showWarningMessage({ modal: true })` through VS Code's
 * DOM (`.monaco-dialog-box`) so Playwright can click/dismiss the `PromptService.confirmOrThrow` modal
 * (org list clean). Native Electron dialogs are inaccessible to Playwright. */
export const orgDesktopMinimalDefaultCustomDialogTest = createDesktopTest({
  fixturesDir: __dirname,
  additionalExtensionDirs: ['salesforcedx-vscode-core'],
  orgAlias: MINIMAL_ORG_ALIAS,
  userSettings: {
    'window.dialogStyle': 'custom'
  }
});
