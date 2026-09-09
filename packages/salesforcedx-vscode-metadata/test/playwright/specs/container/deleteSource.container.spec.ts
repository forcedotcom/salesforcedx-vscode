/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for delete-from-project-and-org. The web twin (deleteSource.headless.spec.ts)
 * proves the delete command + confirmation flow runs against a plain Page; this proves a delete actually
 * reaches the org from inside the Code Builder image, using the container's boot-authed org.
 *
 * Creates a uniquely-named throwaway class, deploys it, then deletes it from project + org, so the shared
 * mounted fixture and seeded classes are untouched. Completion is asserted from the "Deleted Source"
 * output line and the file leaving the explorer — the full metadata/CLI path (extension -> sf -> org) web
 * mode cannot cover.
 */

import {
  clearAllNotifications,
  clearOutputChannel,
  closeAllEditors,
  closeWelcomeTabs,
  createApexClass,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  NOTIFICATION_LIST_ITEM,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { expect } from '@playwright/test';
import { messages } from '../../../../src/messages/i18n';
import { DEPLOY_TIMEOUT } from '../../../constants';
import { containerTest as test } from '../../fixtures/containerFixtures';

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('Delete Source (Code Builder): deletes a class from project and org via command palette', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const className = `DeleteSourceTest${Date.now()}`;

  await test.step('workbench ready', async () => {
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'deleteSource.container.01-ready.png');
  });

  await test.step('create and deploy a throwaway apex class', async () => {
    await createApexClass(page, className);
    await saveScreenshot(page, 'deleteSource.container.02-created.png');

    // Focus the freshly created class and wait until the palette deploy command is contributed for it.
    // The editor context keys (sf:in_package_directories) settle a beat after the file opens, so
    // deploying immediately can miss the "SFDX: Deploy This Source to Org" palette entry.
    const createdEditor = page.locator(`[data-uri*="${className}.cls"]`).first();
    await createdEditor.waitFor({ state: 'visible', timeout: 15_000 });
    await createdEditor.click();
    await verifyCommandExists(page, messages.deploy_this_source_text, 60_000);

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, messages.deploy_this_source_text);
    // The transient "Deploying" toast can be missed on a fast container deploy; assert completion via
    // the output channel instead.
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
    await saveScreenshot(page, 'deleteSource.container.03-deployed.png');
  });

  await test.step('delete source file from project and org', async () => {
    const explorerFileBefore = page
      .locator('[role="treeitem"]')
      .filter({ hasText: new RegExp(`${className}\\.cls$`, 'i') });
    await expect(explorerFileBefore.first()).toBeVisible();

    // Clear output so deploy output from the previous step does not match the delete assertions.
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, messages.delete_source_text);
    await saveScreenshot(page, 'deleteSource.container.04-after-delete-command.png');

    // Confirm the delete via the notification button.
    const deleteConfirmation = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: messages.delete_source_confirmation_message })
      .first();
    await expect(deleteConfirmation).toBeVisible({ timeout: 10_000 });
    await deleteConfirmation.getByRole('button', { name: messages.confirm_delete_source_button_text }).click();
    await saveScreenshot(page, 'deleteSource.container.05-confirmed.png');

    await waitForOutputChannelText(page, { expectedText: 'Deleting', timeout: 30_000 });
    await waitForOutputChannelText(page, { expectedText: 'Deleted Source', timeout: DEPLOY_TIMEOUT });
    await saveScreenshot(page, 'deleteSource.container.06-deleted.png');

    // File should leave the explorer (desktop explorer refresh can lag, so poll).
    await expect(async () => {
      expect(
        await page
          .locator('[role="treeitem"]')
          .filter({ hasText: new RegExp(`${className}\\.cls$`, 'i') })
          .count(),
        `File ${className}.cls should not be in explorer`
      ).toBe(0);
    }).toPass({ timeout: 60_000 });
    await saveScreenshot(page, 'deleteSource.container.07-removed-from-explorer.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
