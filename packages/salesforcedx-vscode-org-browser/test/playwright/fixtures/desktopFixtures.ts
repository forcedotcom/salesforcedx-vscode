/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopTest, DREAMHOUSE_ORG_ALIAS } from '@salesforce/playwright-vscode-ext';

// all tests use dreamhouse org
// window.dialogStyle: custom routes showWarningMessage({ modal: true }) (overwrite confirmation)
// through VS Code's DOM (.monaco-dialog-box) instead of Electron's native dialog, which Playwright can't reach
export const test = createDesktopTest({
  fixturesDir: __dirname,
  orgAlias: DREAMHOUSE_ORG_ALIAS,
  userSettings: { 'window.dialogStyle': 'custom' }
});
