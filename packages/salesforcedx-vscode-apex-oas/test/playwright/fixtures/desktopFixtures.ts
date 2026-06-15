/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopTest, executeCommandWithCommandPalette, MINIMAL_ORG_ALIAS } from '@salesforce/playwright-vscode-ext';

const A4V_EXTENSION_ID = 'salesforce.salesforcedx-einstein-gpt';

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
  marketplaceExtensions: [A4V_EXTENSION_ID],
  // Marketplace-installed A4V must load; --disable-extensions blocks it.
  disableOtherExtensions: false,
  userSettings: {
    'salesforcedx-vscode-core.SF_LOG_LEVEL': 'debug',
    'workbench.editor.enablePreview': false,
    // Routes showWarningMessage({ modal: true }) through VS Code's DOM (.monaco-dialog-box)
    // so Playwright can click Overwrite/Manually-merge buttons. Native Electron dialogs are inaccessible.
    'window.dialogStyle': 'custom'
  }
});

// TODO: Unskip when OAS migrates off the A4V LLM service. A4V v4.0+ ("Agentforce Vibes",
// marketplace id salesforce.salesforcedx-einstein-gpt, published 2026-06-13) dropped both the
// `salesforcedx-einstein-gpt.isEnabled` context key (gates the OAS command's visibility) and the
// `salesforcedx-einstein-gpt.getLLMServiceInstance` command / LLMService registration that OAS
// generation invokes at runtime. The fixture installs A4V unpinned from the marketplace, so every
// run now gets v4 and these specs hang waiting on a command that never appears. Skipping here (one
// place — all 9 specs share this fixture) keeps CI green until OAS re-plumbs its LLM access.
oasDesktopTest.beforeEach(() => {
  oasDesktopTest.skip(true, 'A4V v4 removed the einstein-gpt isEnabled context key and LLMService — OAS commands unavailable');
});

// Match metadata specs: close editors at end so the next test starts clean and final state is tidy.
oasDesktopTest.afterEach(async ({ page }) => {
  if (!page) return;
  await executeCommandWithCommandPalette(page, 'View: Close All Editors').catch(() => {});
});
