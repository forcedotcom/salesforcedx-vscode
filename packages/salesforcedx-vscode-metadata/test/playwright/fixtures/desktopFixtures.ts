/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  createDesktopTest,
  DREAMHOUSE_ORG_ALIAS,
  MINIMAL_ORG_ALIAS,
  NON_TRACKING_ORG_ALIAS
} from '@salesforce/playwright-vscode-ext';
import { deployApexClass } from '../utils/helperProject';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

type HelperProject = (name: string, content: string) => Promise<void>;

export const desktopTest = createDesktopTest({
  fixturesDir: __dirname,
  orgAlias: MINIMAL_ORG_ALIAS,
  additionalExtensionDirs: ['salesforcedx-vscode-apex-log'],
  userSettings: {
    'salesforcedx-vscode-core.useMetadataExtensionCommands': true
  }
});
export const dreamhouseDesktopTest = createDesktopTest({
  fixturesDir: __dirname,
  orgAlias: DREAMHOUSE_ORG_ALIAS,
  additionalExtensionDirs: ['salesforcedx-vscode-apex-log'],
  userSettings: {
    'salesforcedx-vscode-core.useMetadataExtensionCommands': true
  }
});
export const nonTrackingDesktopTest = createDesktopTest({
  fixturesDir: __dirname,
  orgAlias: NON_TRACKING_ORG_ALIAS,
  additionalExtensionDirs: ['salesforcedx-vscode-apex-log'],
  userSettings: {
    'salesforcedx-vscode-core.useMetadataExtensionCommands': true
  }
});
export const emptyWorkspaceDesktopTest = createDesktopTest({
  fixturesDir: __dirname,
  emptyWorkspace: true,
  userSettings: {
    'salesforcedx-vscode-core.useMetadataExtensionCommands': true
  }
});

// Conflict detection test fixtures with helper project and fast polling.
//
// playwrightDialogSettings routes dialogs through VS Code's DOM so Playwright can interact with
// them instead of Electron/OS native dialogs that are inaccessible to Playwright.
const playwrightDialogSettings = {
  // uses VS Code's file picker instead of the native OS file picker
  'files.simpleDialog.enable': true,
  // keeps VS Code menus in the DOM for consistent interaction
  'window.menuStyle': 'custom',
  // routes showWarningMessage({ modal: true }) through VS Code's DOM renderer (.monaco-dialog-box)
  // instead of Electron's native dialog.showMessageBox(), which Playwright cannot interact with
  'window.dialogStyle': 'custom'
} as const;

export const trackingConflictTest = createDesktopTest({
  fixturesDir: __dirname,
  orgAlias: MINIMAL_ORG_ALIAS,
  additionalExtensionDirs: ['salesforcedx-vscode-apex-log'],
  userSettings: {
    'salesforcedx-vscode-core.useMetadataExtensionCommands': true,
    'salesforcedx-vscode-core.detectConflictsForDeployAndRetrieve': true,
    'salesforcedx-vscode-metadata.sourceTracking.pollingIntervalSeconds': 3,
    ...playwrightDialogSettings
  }
}).extend<{ helperProject: HelperProject; statusBarPage: SourceTrackingStatusBarPage }>({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  helperProject: async ({}: any, use: any) => {
    const dir = path.join(os.tmpdir(), `conflict-helper-${Date.now()}-${Math.random()}`);

    // Create sfdx-project.json
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'sfdx-project.json'),
      JSON.stringify(
        {
          packageDirectories: [{ path: 'force-app', default: true }],
          namespace: '',
          sfdcLoginUrl: 'https://login.salesforce.com',
          sourceApiVersion: '62.0'
        },
        null,
        2
      )
    );

    await use((name: string, content: string) => deployApexClass(dir, MINIMAL_ORG_ALIAS, name, content));

    // Cleanup not needed - OS temp cleanup handles it
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  statusBarPage: async ({ page }: any, use: any) => {
    await use(new SourceTrackingStatusBarPage(page));
  }
});

export const nonTrackingConflictTest = createDesktopTest({
  fixturesDir: __dirname,
  orgAlias: NON_TRACKING_ORG_ALIAS,
  additionalExtensionDirs: ['salesforcedx-vscode-apex-log'],
  userSettings: {
    'salesforcedx-vscode-core.useMetadataExtensionCommands': true,
    'salesforcedx-vscode-core.detectConflictsForDeployAndRetrieve': true,
    'salesforcedx-vscode-metadata.sourceTracking.pollingIntervalSeconds': 3,
    ...playwrightDialogSettings
  }
}).extend<{ helperProject: HelperProject }>({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  helperProject: async ({}: any, use: any) => {
    const dir = path.join(os.tmpdir(), `conflict-helper-${Date.now()}-${Math.random()}`);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'sfdx-project.json'),
      JSON.stringify(
        {
          packageDirectories: [{ path: 'force-app', default: true }],
          namespace: '',
          sfdcLoginUrl: 'https://login.salesforce.com',
          sourceApiVersion: '62.0'
        },
        null,
        2
      )
    );
    await use((name: string, content: string) => deployApexClass(dir, NON_TRACKING_ORG_ALIAS, name, content));
  }
});
