/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  closeAllEditors,
  createDesktopTest,
  MINIMAL_ORG_ALIAS
} from '@salesforce/playwright-vscode-ext';

const A4V_MARKETPLACE_EXTENSION = 'salesforce.salesforcedx-einstein-gpt@3.40.0';

const baseExtensionDirs = [
  'salesforcedx-vscode-core',
  'salesforcedx-vscode-apex',
  'salesforcedx-vscode-apex-log',
  'salesforcedx-vscode-metadata'
];

export const oasDesktopTest = createDesktopTest({
  fixturesDir: __dirname,
  orgAlias: MINIMAL_ORG_ALIAS,
  additionalExtensionDirs: baseExtensionDirs,
  marketplaceExtensions: [A4V_MARKETPLACE_EXTENSION],
  // Marketplace-installed A4V must load; --disable-extensions blocks it.
  disableOtherExtensions: false,
  userSettings: {
    'salesforcedx-vscode-core.SF_LOG_LEVEL': 'debug',
    'salesforcedx-vscode-apex-oas.enableRestOASGen': true,
    'workbench.editor.enablePreview': false,
    // Routes showWarningMessage({ modal: true }) through VS Code's DOM (.monaco-dialog-box)
    // so Playwright can click Overwrite/Manually-merge buttons. Native Electron dialogs are inaccessible.
    'window.dialogStyle': 'custom'
  }
});

// Match metadata specs: close editors at end so the next test starts clean and final state is tidy.
oasDesktopTest.afterEach(async ({ page }) => {
  if (!page) return;
  await closeAllEditors(page).catch(() => {});
});
