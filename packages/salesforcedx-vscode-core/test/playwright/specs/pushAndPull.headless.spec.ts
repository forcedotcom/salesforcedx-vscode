/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test } from '../fixtures';
import {
  setupConsoleMonitoring,
  createApexClass,
  editOpenFile,
  executeCommandWithCommandPalette,
  verifyCommandExists,
  clearOutputChannel,
  waitForOutputChannelText,
  validateNoCriticalErrors,
  saveScreenshot
} from '@salesforce/playwright-vscode-ext';
import { COMMAND_TIMEOUT } from '../constants';
import { setupWorkbenchSettingsAndOutputChannel } from '../setupHelpers';
import packageNls from '../../../package.nls.json';

test('Push and Pull: push, pull, and view changes', async ({ page }) => {
  test.setTimeout(COMMAND_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const className = `PushPullTest${Date.now()}`;

  const SOURCE_STATUS_HEADER = 'Source Status';

  await test.step('setup: workbench, settings, output channel', async () => {
    await setupWorkbenchSettingsAndOutputChannel(page);
  });

  await test.step('view all changes (empty)', async () => {
    await clearOutputChannel(page);
    await verifyCommandExists(page, packageNls.view_all_changes_text, 120_000);
    await executeCommandWithCommandPalette(page, packageNls.view_all_changes_text);
    await waitForOutputChannelText(page, {
      expectedText: SOURCE_STATUS_HEADER,
      timeout: COMMAND_TIMEOUT
    });
    await saveScreenshot(page, 'view-all-empty.complete.png');
  });

  await test.step('view local changes (empty)', async () => {
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.view_local_changes_text);
    await waitForOutputChannelText(page, {
      expectedText: 'No local or remote changes found',
      timeout: COMMAND_TIMEOUT
    });
    await saveScreenshot(page, 'view-local-empty.complete.png');
  });

  await test.step('create apex class', async () => {
    await createApexClass(page, className);
    await saveScreenshot(page, 'class-created.png');
  });

  await test.step('view local changes shows new class', async () => {
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.view_local_changes_text);
    await waitForOutputChannelText(page, {
      expectedText: `Local Add  ${className}  ApexClass`,
      timeout: COMMAND_TIMEOUT
    });
    await saveScreenshot(page, 'view-local.complete.png');
  });

  await test.step('push source to org', async () => {
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.project_deploy_start_default_org_text);
    await waitForOutputChannelText(page, {
      expectedText: `Ended ${packageNls.project_deploy_start_default_org_text}`,
      timeout: COMMAND_TIMEOUT
    });
    await waitForOutputChannelText(page, {
      expectedText: `Created  ${className}  ApexClass`,
      timeout: COMMAND_TIMEOUT
    });
    await saveScreenshot(page, 'push.complete.png');
  });

  await test.step('push again with no changes', async () => {
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.project_deploy_start_default_org_text);
    await waitForOutputChannelText(page, {
      expectedText: `Ended ${packageNls.project_deploy_start_default_org_text}`,
      timeout: COMMAND_TIMEOUT
    });
    await waitForOutputChannelText(page, { expectedText: 'No results found', timeout: COMMAND_TIMEOUT });
    await saveScreenshot(page, 'push-no-changes.complete.png');
  });

  await test.step('modify and push', async () => {
    await editOpenFile(page, 'push modification');
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.project_deploy_start_default_org_text);
    await waitForOutputChannelText(page, {
      expectedText: `Ended ${packageNls.project_deploy_start_default_org_text}`,
      timeout: COMMAND_TIMEOUT
    });
    await waitForOutputChannelText(page, {
      expectedText: `Changed  ${className}  ApexClass`,
      timeout: COMMAND_TIMEOUT
    });
    await saveScreenshot(page, 'push-modified.complete.png');
  });

  await test.step('pull source from org', async () => {
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.project_retrieve_start_default_org_text);
    await waitForOutputChannelText(page, {
      expectedText: `Ended ${packageNls.project_retrieve_start_default_org_text}`,
      timeout: COMMAND_TIMEOUT
    });
    // First pull typically gets Admin.profile
    await saveScreenshot(page, 'pull.complete.png');
  });

  await test.step('pull again with no changes', async () => {
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.project_retrieve_start_default_org_text);
    await waitForOutputChannelText(page, {
      expectedText: `Ended ${packageNls.project_retrieve_start_default_org_text}`,
      timeout: COMMAND_TIMEOUT
    });
    await waitForOutputChannelText(page, { expectedText: 'No results found', timeout: COMMAND_TIMEOUT });
    await saveScreenshot(page, 'pull-no-changes.complete.png');
  });

  await test.step('view remote changes', async () => {
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.view_remote_changes_text);
    await waitForOutputChannelText(page, {
      expectedText: SOURCE_STATUS_HEADER,
      timeout: COMMAND_TIMEOUT
    });
    await saveScreenshot(page, 'view-remote.complete.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
