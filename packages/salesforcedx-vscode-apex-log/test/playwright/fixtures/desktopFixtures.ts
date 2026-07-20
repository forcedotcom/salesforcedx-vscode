/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { createDesktopTest, MINIMAL_ORG_ALIAS } from '@salesforce/playwright-vscode-ext';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

export const desktopTest = createDesktopTest({
  fixturesDir: __dirname,
  orgAlias: MINIMAL_ORG_ALIAS,
  additionalExtensionDirs: ['salesforcedx-vscode-metadata'],
  disableOtherExtensions: false,
  userSettings: {
    'git.terminalAuthentication': false,
    'git.autofetch': false
  }
});

export const noOrgDesktopTest = createDesktopTest({
  fixturesDir: __dirname,
  additionalExtensionDirs: ['salesforcedx-vscode-metadata'],
  disableOtherExtensions: false,
  userSettings: {
    'git.terminalAuthentication': false,
    'git.autofetch': false
  }
});

export const emptyWorkspaceDesktopTest = createDesktopTest({
  fixturesDir: __dirname,
  emptyWorkspace: true,
  additionalExtensionDirs: ['salesforcedx-vscode-metadata'],
  disableOtherExtensions: false,
  userSettings: {
    'git.terminalAuthentication': false,
    'git.autofetch': false
  }
});

const createMultiPackageWorkspace = async (): Promise<string> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'vscode-e2e-multi-pkg-'));
  await Promise.all([
    fs.writeFile(
      path.join(dir, 'sfdx-project.json'),
      JSON.stringify(
        {
          packageDirectories: [
            { path: 'force-app', default: true },
            { path: 'extra-pkg' }
          ],
          namespace: '',
          sfdcLoginUrl: 'https://login.salesforce.com',
          sourceApiVersion: '64.0'
        },
        null,
        2
      )
    ),
    fs.mkdir(path.join(dir, 'force-app', 'main', 'default', 'classes'), { recursive: true }),
    fs.mkdir(path.join(dir, 'extra-pkg', 'classes'), { recursive: true }),
    fs.mkdir(path.join(dir, '.sf'), { recursive: true })
  ]);
  return dir;
};

export const multiPackageNoOrgDesktopTest = noOrgDesktopTest.extend<{ workspaceDir: string }>({
  workspaceDir: async ({}, use) => {
    const dir = await createMultiPackageWorkspace();
    await use(dir);
  }
});
