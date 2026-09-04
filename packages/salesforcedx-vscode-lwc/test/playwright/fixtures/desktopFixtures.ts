/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { createDesktopTest, createTestWorkspace } from '@salesforce/playwright-vscode-ext';

import {
  installLwcJestWorkspace,
  linkLwcJestWorkspace,
  seedLwcHeadlessWorkspaceSupplement,
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
}).extend<{}, { lwcJestNodeModulesDir: string }>({
  lwcJestNodeModulesDir: [
    async ({}, use) => {
      const installDir = await fs.mkdtemp(path.join(os.tmpdir(), 'lwc-jest-'));
      await installLwcJestWorkspace(installDir);
      try {
        await use(path.join(installDir, 'node_modules'));
      } finally {
        await fs.rm(installDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
      }
    },
    { scope: 'worker', timeout: 7 * 60 * 1000 }
  ],
  workspaceDir: async ({ lwcJestNodeModulesDir }, use) => {
    const dir = await createTestWorkspace(undefined);
    await seedLwcHeadlessWorkspaceSupplement(dir);
    await linkLwcJestWorkspace(dir, lwcJestNodeModulesDir);
    await use(dir);
  }
});
