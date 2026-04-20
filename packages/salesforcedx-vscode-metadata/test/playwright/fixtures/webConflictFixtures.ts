/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test as webTest } from '@playwright/test';
import {
  MINIMAL_ORG_ALIAS,
  closeWelcomeTabs,
  createMinimalOrg,
  ensureSecondarySideBarHidden,
  upsertScratchOrgAuthFieldsToSettings,
  upsertSettings,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { deployApexClass } from '../utils/helperProject';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

type HelperProject = (name: string, content: string) => Promise<void>;

export const webTrackingConflictTest = webTest.extend<{
  helperProject: HelperProject;
  statusBarPage: SourceTrackingStatusBarPage;
}>({
  helperProject: async ({}, use) => {
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
    await use((name: string, content: string) => deployApexClass(dir, MINIMAL_ORG_ALIAS, name, content));
  },
  statusBarPage: async ({ page }, use) => {
    const createResult = await createMinimalOrg();
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    await upsertSettings(page, { [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
    await upsertSettings(page, { 'salesforcedx-vscode-core.detectConflictsForDeployAndRetrieve': 'true' });
    await upsertSettings(page, { 'salesforcedx-vscode-metadata.sourceTracking.pollingIntervalSeconds': '3' });
    await upsertSettings(page, { 'files.simpleDialog.enable': 'true' });
    await use(new SourceTrackingStatusBarPage(page));
  }
});
