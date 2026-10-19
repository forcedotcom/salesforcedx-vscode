/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { createDesktopTest } from '@salesforce/playwright-vscode-ext';

export const oasVsixSmokeTest = createDesktopTest({
  fixturesDir: __dirname,
  useVsix: true,
  additionalExtensionDirs: ['salesforcedx-vscode-apex'],
  testExtensionPaths: ['test/playwright/fixtureExtensions/packagedActivation']
});
