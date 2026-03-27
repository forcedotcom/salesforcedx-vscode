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
  createApexClass,
  executeCommandWithCommandPalette,
  verifyCommandExists,
  executeEditorContextMenuCommand,
  executeExplorerContextMenuCommand,
  clearOutputChannel,
  waitForOutputChannelText,
  isMacDesktop,
  validateNoCriticalErrors,
  saveScreenshot,
  NOTIFICATION_LIST_ITEM,
  openFileByName
} from '@salesforce/playwright-vscode-ext';
import { COMMAND_TIMEOUT } from '../constants';
import { setupWorkbenchSettingsAndOutputChannel } from '../setupHelpers';
import packageNls from '../../../package.nls.json';

test('Delete: delete from project and org via command palette and context menus', async ({ page }) => {
  test.setTimeout(COMMAND_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const className = `DeleteTest${Date.now()}`;

  await test.step('setup: workbench, settings, create apex class', async () => {
    await setupWorkbenchSettingsAndOutputChannel(page);

    // Create the apex class under test
    await createApexClass(page, className);
    await saveScreenshot(page, 'setup.class-created.png');

    // Wait for extension to fully activate (context keys like sf:has_target_org)
    await verifyCommandExists(page, packageNls.delete_source_this_source_text, 120_000);
  });

  await test.step('delete from project and org', async () => {
    // Push first to sync with org
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.project_deploy_start_ignore_conflicts_default_org_text);
    await waitForOutputChannelText(page, {
      expectedText: `Ended ${packageNls.project_deploy_start_ignore_conflicts_default_org_text}`,
      timeout: COMMAND_TIMEOUT
    });
    await saveScreenshot(page, 'delete.push-complete.png');

    // Execute delete command
    await clearOutputChannel(page);
    await openFileByName(page, `${className}.cls`);
    await executeCommandWithCommandPalette(page, packageNls.delete_source_this_source_text);

    // Wait for and accept the confirmation notification
    const deleteConfirmation = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /Deleting source files/ })
      .first();
    await expect(deleteConfirmation).toBeVisible({ timeout: 10_000 });
    await deleteConfirmation.getByRole('button', { name: 'Delete Source' }).click();
    await saveScreenshot(page, 'delete.confirmed.png');

    // Wait for delete to complete
    await waitForOutputChannelText(page, {
      expectedText: `Ended ${packageNls.delete_source_text}`,
      timeout: COMMAND_TIMEOUT
    });
    await saveScreenshot(page, 'delete.complete.png');
  });

  if (!isMacDesktop()) {
    await test.step('create classes for context menu delete tests', async () => {
      await createApexClass(page, `${className}Del1`);
      await createApexClass(page, `${className}Del2`);

      // Push both to org
      await clearOutputChannel(page);
      await executeCommandWithCommandPalette(page, packageNls.project_deploy_start_ignore_conflicts_default_org_text);
      await waitForOutputChannelText(page, {
        expectedText: `Ended ${packageNls.project_deploy_start_ignore_conflicts_default_org_text}`,
        timeout: COMMAND_TIMEOUT
      });
      await saveScreenshot(page, 'delete-ctx.push-complete.png');
    });

    await test.step('delete via editor context menu', async () => {
      await clearOutputChannel(page);
      await openFileByName(page, `${className}Del1.cls`);
      await executeEditorContextMenuCommand(page, packageNls.delete_source_this_source_text, `${className}Del1.cls`);

      const deleteConfirmation = page
        .locator(NOTIFICATION_LIST_ITEM)
        .filter({ hasText: /Deleting source files/ })
        .first();
      await expect(deleteConfirmation).toBeVisible({ timeout: 10_000 });
      await deleteConfirmation.getByRole('button', { name: 'Delete Source' }).click();

      await waitForOutputChannelText(page, {
        expectedText: `Ended ${packageNls.delete_source_text}`,
        timeout: COMMAND_TIMEOUT
      });
      await saveScreenshot(page, 'delete-editor-context.complete.png');
    });

    await test.step('delete via explorer context menu', async () => {
      await clearOutputChannel(page);
      await executeExplorerContextMenuCommand(
        page,
        new RegExp(`${className}Del2\\.cls`),
        packageNls.delete_source_text
      );

      const deleteConfirmation = page
        .locator(NOTIFICATION_LIST_ITEM)
        .filter({ hasText: /Deleting source files/ })
        .first();
      await expect(deleteConfirmation).toBeVisible({ timeout: 10_000 });
      await deleteConfirmation.getByRole('button', { name: 'Delete Source' }).click();

      await waitForOutputChannelText(page, {
        expectedText: `Ended ${packageNls.delete_source_text}`,
        timeout: COMMAND_TIMEOUT
      });
      await saveScreenshot(page, 'delete-explorer-context.complete.png');
    });
  }

  await validateNoCriticalErrors(test, consoleErrors);
});
