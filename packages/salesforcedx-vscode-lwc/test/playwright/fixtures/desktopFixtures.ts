/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopTest, createTestWorkspace } from '@salesforce/playwright-vscode-ext';

import { seedLwcHeadlessWorkspaceSupplement, seedSnippetsE2eEmptyBundle } from '../utils/createLwcTestWorkspace';

export const desktopTest = createDesktopTest({
  fixturesDir: __dirname,
  disableOtherExtensions: false,
  additionalExtensionDirs: ['salesforcedx-vscode-metadata']
}).extend({
  workspaceDir: async ({}, use) => {
    const dir = await createTestWorkspace(undefined);
    await seedLwcHeadlessWorkspaceSupplement(dir);
    await seedSnippetsE2eEmptyBundle(dir);
    await use(dir);
  }
});
