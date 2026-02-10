/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test } from '../fixtures';
import { expect } from '@playwright/test';
import {
  setupConsoleMonitoring,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createMinimalOrg,
  upsertScratchOrgAuthFieldsToSettings,
  upsertSettings,
  executeCommandWithCommandPalette,
  verifyCommandExists,
  executeEditorContextMenuCommand,
  executeExplorerContextMenuCommand,
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  isMacDesktop,
  validateNoCriticalErrors,
  saveScreenshot,
  NOTIFICATION_LIST_ITEM
} from '@salesforce/playwright-vscode-ext';
import { COMMAND_TIMEOUT, OUTPUT_CHANNEL } from '../constants';
import { createApexClassCore } from '../coreHelpers';

test('Delete: delete from project and org via command palette and context menus', async ({ page }) => {
  test.setTimeout(COMMAND_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const className = `DeleteTest${Date.now()}`;

  await test.step('setup: workbench, settings, create apex class', async () => {
    const createResult = await createMinimalOrg();
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);

    // Ensure core commands are active (not metadata extension commands)
    await upsertSettings(page, { 'salesforcedx-vscode-core.useMetadataExtensionCommands': 'false' });

    // Open output panel and select Salesforce CLI channel
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, OUTPUT_CHANNEL, 120_000);
    await saveScreenshot(page, 'setup.output-channel-ready.png');

    // Create the apex class under test
    await createApexClassCore(page, className);
    await saveScreenshot(page, 'setup.class-created.png');

    // Wait for extension to fully activate (context keys like sf:has_target_org)
    await verifyCommandExists(page, 'SFDX: Delete This from Project and Org', 120_000);
  });

  await test.step('delete from project and org', async () => {
    // Push first to sync with org
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, 'SFDX: Push Source to Default Org and Ignore Conflicts');
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Push Source to Default Org and Ignore Conflicts', timeout: COMMAND_TIMEOUT });
    await saveScreenshot(page, 'delete.push-complete.png');

    // Execute delete command
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, 'SFDX: Delete This from Project and Org');

    // Wait for and accept the confirmation notification
    const deleteConfirmation = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /Deleting source files/ })
      .first();
    await expect(deleteConfirmation).toBeVisible({ timeout: 10_000 });
    await deleteConfirmation.getByRole('button', { name: 'Delete Source' }).click();
    await saveScreenshot(page, 'delete.confirmed.png');

    // Wait for delete to complete
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Delete from Project and Org', timeout: COMMAND_TIMEOUT });
    await saveScreenshot(page, 'delete.complete.png');
  });

  if (!isMacDesktop()) {
    await test.step('create classes for context menu delete tests', async () => {
      await createApexClassCore(page, `${className}Del1`);
      await createApexClassCore(page, `${className}Del2`);

      // Push both to org
      await clearOutputChannel(page);
      await executeCommandWithCommandPalette(page, 'SFDX: Push Source to Default Org and Ignore Conflicts');
      await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Push Source to Default Org and Ignore Conflicts', timeout: COMMAND_TIMEOUT });
      await saveScreenshot(page, 'delete-ctx.push-complete.png');
    });

    await test.step('delete via editor context menu', async () => {
      await clearOutputChannel(page);
      await executeEditorContextMenuCommand(page, 'SFDX: Delete This from Project and Org', `${className}Del1.cls`);

      const deleteConfirmation = page
        .locator(NOTIFICATION_LIST_ITEM)
        .filter({ hasText: /Deleting source files/ })
        .first();
      await expect(deleteConfirmation).toBeVisible({ timeout: 10_000 });
      await deleteConfirmation.getByRole('button', { name: 'Delete Source' }).click();

      await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Delete from Project and Org', timeout: COMMAND_TIMEOUT });
      await saveScreenshot(page, 'delete-editor-context.complete.png');
    });

    await test.step('delete via explorer context menu', async () => {
      await clearOutputChannel(page);
      await executeExplorerContextMenuCommand(
        page,
        new RegExp(`${className}Del2\\.cls`),
        'SFDX: Delete from Project and Org'
      );

      const deleteConfirmation = page
        .locator(NOTIFICATION_LIST_ITEM)
        .filter({ hasText: /Deleting source files/ })
        .first();
      await expect(deleteConfirmation).toBeVisible({ timeout: 10_000 });
      await deleteConfirmation.getByRole('button', { name: 'Delete Source' }).click();

      await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Delete from Project and Org', timeout: COMMAND_TIMEOUT });
      await saveScreenshot(page, 'delete-explorer-context.complete.png');
    });
  }

  await validateNoCriticalErrors(test, consoleErrors);
});
