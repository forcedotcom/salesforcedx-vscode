/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Page } from '@playwright/test';
import type { AuthFields } from '@salesforce/core';
import {
  createMinimalOrg,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  upsertScratchOrgAuthFieldsToSettings,
  verifyCommandExists,
  ensureOutputPanelOpen,
  selectOutputChannel,
  saveScreenshot
} from '@salesforce/playwright-vscode-ext';
import { OUTPUT_CHANNEL } from './constants';
import packageNls from '../../package.nls.json';

type OrgAuthResult = Required<Pick<AuthFields, 'instanceUrl' | 'accessToken' | 'instanceApiVersion'>>;

/**
 * Shared setup: create org, workbench, auth, core commands, output channel.
 * Used by deployAndRetrieve, pushAndPull, metadataDeployRetrieve, manifestBuilder, delete, deployOnSave.
 */
export const setupWorkbenchSettingsAndOutputChannel = async (page: Page): Promise<void> => {
  const createResult: OrgAuthResult = await createMinimalOrg();
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await upsertScratchOrgAuthFieldsToSettings(page, createResult);
  await verifyCommandExists(page, packageNls.apex_generate_class_text, 120_000);

  // Open output panel and select Salesforce CLI channel
  await ensureOutputPanelOpen(page);
  await selectOutputChannel(page, OUTPUT_CHANNEL, 120_000);
  await saveScreenshot(page, 'setup.complete.png');
};
