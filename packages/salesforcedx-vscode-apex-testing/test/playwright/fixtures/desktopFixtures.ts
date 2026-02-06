/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopTest, MINIMAL_ORG_ALIAS } from '@salesforce/playwright-vscode-ext';
import * as path from 'node:path';

const packageRoot = path.resolve(__dirname, '..', '..', '..');
const metadataPath = path.resolve(packageRoot, '..', 'salesforcedx-vscode-metadata');

export const desktopTest = createDesktopTest({
  fixturesDir: __dirname,
  orgAlias: MINIMAL_ORG_ALIAS,
  additionalExtensionPaths: [metadataPath],
  disableOtherExtensions: false,
  userSettings: {
    'github.gitAuthentication': false,
    'git.terminalAuthentication': false,
    'git.autofetch': false
  }
});
