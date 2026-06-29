/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopTest } from '@salesforce/playwright-vscode-ext';

/** Desktop test for sf.org.delete.username. No `orgAlias`: the spec creates a dedicated, dynamically
 * named scratch org via the CLI (never the shared MINIMAL_ORG_ALIAS) and actually deletes it, so it
 * must not yank a shared org out from under parallel specs. `window.dialogStyle: custom` routes the
 * delete confirm `showWarningMessage({ modal: true })` through VS Code's DOM (.monaco-dialog-box) so
 * Playwright can click the Delete button (native Electron dialogs are inaccessible). */
export const orgDeleteUsernameTest = createDesktopTest({
  fixturesDir: __dirname,
  additionalExtensionDirs: ['salesforcedx-vscode-core'],
  userSettings: {
    'window.dialogStyle': 'custom'
  }
});
