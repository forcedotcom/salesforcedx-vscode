/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopTest } from '@salesforce/playwright-vscode-ext';
import { createLwcTestWorkspace } from '../utils/createLwcTestWorkspace';

const baseDesktop = createDesktopTest({
  fixturesDir: __dirname,
  additionalExtensionDirs: ['salesforcedx-vscode-metadata'],
  disableOtherExtensions: false,
  userSettings: {
    'github.gitAuthentication': false,
    'git.terminalAuthentication': false,
    'git.autofetch': false
  }
});

/** Desktop E2E with the same pre-seeded LWC tree as the web headless server. */
export const desktopTest = baseDesktop.extend({
  workspaceDir: async ({}, use) => {
    const dir = await createLwcTestWorkspace();
    await use(dir);
  }
});
