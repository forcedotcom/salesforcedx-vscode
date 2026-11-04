/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createDesktopTest } from '@salesforce/playwright-vscode-ext';

const APEX_LANGUAGE_SERVER_EXTENSION_ID = 'salesforce.apex-language-server-extension';

export const oasVsixSmokeTest = createDesktopTest({
  fixturesDir: __dirname,
  useVsix: true,
  marketplaceExtensions: [APEX_LANGUAGE_SERVER_EXTENSION_ID],
  minimumMarketplaceExtensionVersions: { [APEX_LANGUAGE_SERVER_EXTENSION_ID]: '0.11.0' },
  testExtensionPaths: ['test/playwright/fixtureExtensions/packagedActivation']
});
