/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  closeAllEditors,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandById,
  selectOutputChannel,
  verifyCommandExists,
  waitForNotification,
  waitForOutputChannelText,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { messages } from '../../../src/messages/i18n';
import { test } from '../fixtures';

test('tagged command errors include the tag only in channel output', async ({ page }) => {
  test.setTimeout(120_000);
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await verifyCommandExists(page, packageNls.project_info_text, 60_000);
  await closeAllEditors(page);

  await executeCommandById(page, 'sf.metadata.deploy.in.manifest');

  const notification = await waitForNotification(page, new RegExp(`^${messages.deploy_select_manifest}$`));
  await expect(notification, 'Error notification should remain unprefixed').toHaveText(messages.deploy_select_manifest);

  await selectOutputChannel(page, 'Salesforce Metadata');
  await waitForOutputChannelText(page, {
    expectedText: `[ManifestSelectionRequiredError] ${messages.deploy_select_manifest}`
  });
});
