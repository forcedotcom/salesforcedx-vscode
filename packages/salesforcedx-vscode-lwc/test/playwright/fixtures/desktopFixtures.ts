/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopTest, createTestWorkspace } from '@salesforce/playwright-vscode-ext';

import {
  seedLwcHeadlessWorkspaceSupplement,
  seedLwcJestWorkspace,
  seedSnippetsE2eEmptyBundle
} from '../utils/createLwcTestWorkspace';

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

/**
 * Desktop fixture with `@salesforce/sfdx-lwc-jest` pre-installed in the workspace.
 * Use for specs that run or debug LWC Jest tests (requires Node on the host).
 */
export const desktopJestTest = createDesktopTest({
  fixturesDir: __dirname,
  disableOtherExtensions: false,
  additionalExtensionDirs: ['salesforcedx-vscode-metadata']
}).extend({
  workspaceDir: async ({}, use) => {
    const dir = await createTestWorkspace(undefined);
    await seedLwcHeadlessWorkspaceSupplement(dir);
    await seedLwcJestWorkspace(dir);
    await use(dir);
  }
});
