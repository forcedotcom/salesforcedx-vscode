/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { createDesktopTest, createTestWorkspace } from '@salesforce/playwright-vscode-ext';

import { seedLwcHeadlessWorkspaceSupplement, seedSnippetsE2eEmptyBundle } from '../utils/createLwcTestWorkspace';

export const desktopTest = createDesktopTest({
  fixturesDir: __dirname,
  disableOtherExtensions: false,
  additionalExtensionDirs: ['salesforcedx-vscode-metadata']
}).extend({
  workspaceDir: async ({}, use) => {
    const dir = await createTestWorkspace(undefined);
    const sfdxProjectPath = path.join(dir, 'sfdx-project.json');
    const parsed: unknown = JSON.parse(await fs.readFile(sfdxProjectPath, 'utf8'));
    if (typeof parsed === 'object' && parsed !== null) {
      await fs.writeFile(sfdxProjectPath, JSON.stringify({ ...parsed, defaultLwcLanguage: 'javascript' }, null, 2));
    }
    await seedLwcHeadlessWorkspaceSupplement(dir);
    await seedSnippetsE2eEmptyBundle(dir);
    await use(dir);
  }
});
