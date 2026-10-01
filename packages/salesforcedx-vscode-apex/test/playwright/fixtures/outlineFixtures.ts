/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopTest } from '@salesforce/playwright-vscode-ext';

import { outlineLanguageServerSettings, seedOutlineWorkspace } from './outlineWorkspace';

const APEX_LANGUAGE_SERVER_EXTENSION_ID = 'salesforce.apex-language-server-extension';

const baseTest = createDesktopTest({
  fixturesDir: __dirname,
  skipCurrentPackage: true,
  marketplaceExtensions: [APEX_LANGUAGE_SERVER_EXTENSION_ID],
  disableOtherExtensions: false,
  userSettings: outlineLanguageServerSettings
});

export const outlineDesktopTest = baseTest.extend<{ workspaceDir: string }>({
  workspaceDir: async ({ workspaceDir }, use) => {
    await seedOutlineWorkspace(workspaceDir);
    await use(workspaceDir);
  }
});
