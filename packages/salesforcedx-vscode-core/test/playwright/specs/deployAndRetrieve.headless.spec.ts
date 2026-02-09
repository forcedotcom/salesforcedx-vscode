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
  editOpenFile,
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

test('Deploy and Retrieve: deploy, retrieve, and delete via command palette and context menus', async ({ page }) => {
  test.setTimeout(COMMAND_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const className = `DeployRetrieveTest${Date.now()}`;

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
    await verifyCommandExists(page, 'SFDX: Deploy This Source to Org', 120_000);
  });

  await test.step('deploy via command palette (ST enabled)', async () => {
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, 'SFDX: Deploy This Source to Org');
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Deploy This Source to Org', timeout: COMMAND_TIMEOUT });
    await saveScreenshot(page, 'deploy-st.complete.png');
  });

  await test.step('deploy again with no changes (ST enabled)', async () => {
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, 'SFDX: Deploy This Source to Org');
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Deploy This Source to Org', timeout: COMMAND_TIMEOUT });
    await saveScreenshot(page, 'deploy-st-no-changes.complete.png');
  });

  await test.step('modify and deploy (ST enabled)', async () => {
    await clearOutputChannel(page);
    await editOpenFile(page, 'deploy modification');
    await executeCommandWithCommandPalette(page, 'SFDX: Deploy This Source to Org');
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Deploy This Source to Org', timeout: COMMAND_TIMEOUT });
    await saveScreenshot(page, 'deploy-st-modified.complete.png');
  });

  // Context menus don't work on Mac desktop
  if (!isMacDesktop()) {
    await test.step('deploy via editor context menu', async () => {
      await clearOutputChannel(page);
      await executeEditorContextMenuCommand(page, 'SFDX: Deploy This Source to Org', `${className}.cls`);
      await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Deploy This Source to Org', timeout: COMMAND_TIMEOUT });
      await saveScreenshot(page, 'deploy-editor-context.complete.png');
    });

    await test.step('deploy via explorer context menu', async () => {
      await clearOutputChannel(page);
      await executeExplorerContextMenuCommand(page, new RegExp(`${className}\\.cls`), 'SFDX: Deploy This Source to Org');
      await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Deploy This Source to Org', timeout: COMMAND_TIMEOUT });
      await saveScreenshot(page, 'deploy-explorer-context.complete.png');
    });
  }

  await test.step('retrieve via command palette', async () => {
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, 'SFDX: Retrieve This Source from Org');
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Retrieve This Source from Org', timeout: COMMAND_TIMEOUT });
    await saveScreenshot(page, 'retrieve.complete.png');
  });

  await test.step('modify file, retrieve, verify content reverts', async () => {
    // Edit the file with a unique marker comment
    await editOpenFile(page, 'WILL_BE_REVERTED');
    await saveScreenshot(page, 'retrieve-revert.after-edit.png');

    // Retrieve should overwrite local with org version (without the marker)
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, 'SFDX: Retrieve This Source from Org');
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Retrieve This Source from Org', timeout: COMMAND_TIMEOUT });

    // Verify the marker comment is gone from the editor
    const editor = page.locator(`[data-uri*="${className}.cls"] .view-lines`).first();
    await expect(editor).toBeVisible({ timeout: 10_000 });
    const editorText = await editor.textContent();
    expect(editorText, 'File should not contain the edit marker after retrieve').not.toContain('WILL_BE_REVERTED');
    await saveScreenshot(page, 'retrieve-revert.complete.png');
  });

  if (!isMacDesktop()) {
    await test.step('retrieve via editor context menu', async () => {
      await clearOutputChannel(page);
      await executeEditorContextMenuCommand(page, 'SFDX: Retrieve This Source from Org', `${className}.cls`);
      await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Retrieve This Source from Org', timeout: COMMAND_TIMEOUT });
      await saveScreenshot(page, 'retrieve-editor-context.complete.png');
    });

    await test.step('retrieve via explorer context menu', async () => {
      await clearOutputChannel(page);
      await executeExplorerContextMenuCommand(page, new RegExp(`${className}\\.cls`), 'SFDX: Retrieve This Source from Org');
      await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Retrieve This Source from Org', timeout: COMMAND_TIMEOUT });
      await saveScreenshot(page, 'retrieve-explorer-context.complete.png');
    });
  }

  await test.step('deploy on save', async () => {
    await upsertSettings(page, {
      'salesforcedx-vscode-core.push-or-deploy-on-save.enabled': 'true',
      'salesforcedx-vscode-core.push-or-deploy-on-save.preferDeployOnSave': 'true'
    });
    await clearOutputChannel(page);

    // Edit and save triggers deploy-on-save
    await editOpenFile(page, 'trigger deploy on save');
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Deploy This Source to Org', timeout: COMMAND_TIMEOUT });
    await saveScreenshot(page, 'deploy-on-save.complete.png');

    // Disable deploy-on-save settings
    await upsertSettings(page, {
      'salesforcedx-vscode-core.push-or-deploy-on-save.enabled': 'false',
      'salesforcedx-vscode-core.push-or-deploy-on-save.preferDeployOnSave': 'false'
    });
  });

  await test.step('disable ST and deploy', async () => {
    await upsertSettings(page, {
      'salesforcedx-vscode-core.experimental.enableSourceTrackingForDeployAndRetrieve': 'false'
    });
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, 'SFDX: Deploy This Source to Org');
    await waitForOutputChannelText(page, { expectedText: 'Ended SFDX: Deploy This Source to Org', timeout: COMMAND_TIMEOUT });
    await saveScreenshot(page, 'deploy-no-st.complete.png');

    // Re-enable ST
    await upsertSettings(page, {
      'salesforcedx-vscode-core.experimental.enableSourceTrackingForDeployAndRetrieve': 'true'
    });
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
