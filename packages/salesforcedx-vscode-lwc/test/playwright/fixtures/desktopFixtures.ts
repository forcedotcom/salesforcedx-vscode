/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { createDesktopTest, createTestWorkspace } from '@salesforce/playwright-vscode-ext';

export const desktopTest = createDesktopTest({
  fixturesDir: __dirname,
  disableOtherExtensions: false
}).extend({
  workspaceDir: async ({}, use) => {
    const dir = await createTestWorkspace(undefined);
    const bundleDir = path.join(dir, 'force-app', 'main', 'default', 'lwc', 'snippetE2e');
    await fs.mkdir(bundleDir, { recursive: true });
    await fs.writeFile(path.join(bundleDir, 'snippetE2e.html'), '', 'utf8');
    await fs.writeFile(path.join(bundleDir, 'snippetE2e.js'), '', 'utf8');
    await use(dir);
  }
});
