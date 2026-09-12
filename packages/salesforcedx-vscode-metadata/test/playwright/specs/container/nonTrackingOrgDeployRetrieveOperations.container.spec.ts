/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Code Builder container twin of nonTrackingOrgDeployRetrieveOperations.headless.
 *
 * The twin proves deploy / retrieve / delete of a single class work when the DEFAULT org has NO source
 * tracking. The container boots a source-TRACKING org as its default, so this spec uses the multi-org
 * capability (W-23898526): switch the DEFAULT to the second, NON-tracking org (nonTrackingTestOrg,
 * CB_EXTRA_ORG_ALIASES) via the status-bar picker, run the operations against it, and RESTORE the boot org
 * as default (REQUIRED) so the shared serial session is not contaminated.
 *
 * A uniquely-named throwaway class is created, deployed, retrieved, then deleted from project + org (as the
 * deleteSource container twin does), so the mounted fixture and seeded classes are untouched. The throwaway
 * class is created only AFTER the non-tracking org is the default and is removed BEFORE the boot org is
 * restored, so no stray local change leaks into the tracking boot org. Depends on CB_EXTRA_ORG_ALIASES;
 * skips (never false-fails) when the extra org isn't authed.
 */

import {
  clearAllNotifications,
  clearOutputChannel,
  clickModalDialogButton,
  closeAllEditors,
  closeWelcomeTabs,
  createApexClass,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  env,
  execAsync,
  executeCommandWithCommandPalette,
  expectOrgPickerStatusBar,
  MINIMAL_ORG_ALIAS,
  NON_TRACKING_ORG_ALIAS,
  openFileByName,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  switchDefaultOrgViaPicker,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { expect } from '@playwright/test';
import { messages } from '../../../../src/messages/i18n';
import { DEPLOY_TIMEOUT, RETRIEVE_TIMEOUT } from '../../../constants';
import { containerTest as test } from '../../fixtures/containerFixtures';

/** Resolve an org's username from the host CLI (the label the in-container picker shows for an unaliased org). */
const resolveOrgUsername = async (alias: string): Promise<string> => {
  const { stdout } = await execAsync(`sf org display -o ${alias} --json`, { env });
  const parsed = JSON.parse(stdout) as { result?: { username?: string } };
  const username = parsed.result?.username;
  if (!username) {
    throw new Error(`could not resolve username for org "${alias}" from \`sf org display\``);
  }
  return username;
};

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('Non-Tracking Org (Code Builder): deploy/retrieve operations work without tracking', async ({ page }) => {
  test.setTimeout(RETRIEVE_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const bootOrgUsername = await resolveOrgUsername(MINIMAL_ORG_ALIAS).catch(() => undefined);
  const extraOrgAuthed = await resolveOrgUsername(NON_TRACKING_ORG_ALIAS).catch(() => undefined);

  test.skip(
    !bootOrgUsername || !extraOrgAuthed,
    `needs both "${MINIMAL_ORG_ALIAS}" (boot) and "${NON_TRACKING_ORG_ALIAS}" (CB_EXTRA_ORG_ALIASES) authed on the host`
  );
  const bootOrgLabel = bootOrgUsername!;

  // Unique per run so the shared, persistent workbench never collides across runs.
  const className = `NonTrackingOpsTest${Date.now()}`;

  await test.step('workbench ready', async () => {
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'nonTrackingDeployRetrieveOps.container.01-ready.png');
  });

  let switchedToExtra = false;
  try {
    await test.step('switch default org to nonTrackingTestOrg and assert it took', async () => {
      await expectOrgPickerStatusBar(page, bootOrgLabel);
      // Re-drives the picker if the status-bar switch doesn't take (container config-watcher race).
      switchedToExtra = true;
      await switchDefaultOrgViaPicker(page, {
        fromLabel: bootOrgLabel,
        filterText: NON_TRACKING_ORG_ALIAS,
        expectLabel: NON_TRACKING_ORG_ALIAS,
        assertListsOrg: NON_TRACKING_ORG_ALIAS
      });
      await saveScreenshot(page, 'nonTrackingDeployRetrieveOps.container.02-switched-to-nontracking.png');
    });

    await test.step('create a throwaway apex class', async () => {
      await createApexClass(page, className);
      const createdEditor = page.locator(`[data-uri*="${className}.cls"]`).first();
      await createdEditor.waitFor({ state: 'visible', timeout: 15_000 });
      await createdEditor.click();
      // The editor context keys (sf:in_package_directories) settle a beat after the file opens.
      await verifyCommandExists(page, messages.deploy_this_source_text, 60_000);
      await saveScreenshot(page, 'nonTrackingDeployRetrieveOps.container.03-created.png');
    });

    await test.step('deploy class to the non-tracking org', async () => {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
      await clearOutputChannel(page);
      await openFileByName(page, `${className}.cls`);

      await executeCommandWithCommandPalette(page, messages.deploy_this_source_text);
      await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
      await saveScreenshot(page, 'nonTrackingDeployRetrieveOps.container.04-deployed.png');
    });

    await test.step('retrieve class from the non-tracking org', async () => {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
      await clearOutputChannel(page);
      await openFileByName(page, `${className}.cls`);

      await executeCommandWithCommandPalette(page, messages.retrieve_this_source_text);
      await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
      await waitForOutputChannelText(page, { expectedText: 'Retrieved Source', timeout: RETRIEVE_TIMEOUT });
      await saveScreenshot(page, 'nonTrackingDeployRetrieveOps.container.05-retrieved.png');
    });

    await test.step('delete class from project and the non-tracking org', async () => {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
      await clearOutputChannel(page);
      await openFileByName(page, `${className}.cls`);

      await executeCommandWithCommandPalette(page, messages.delete_source_text);

      // The delete confirmation is a modal warning dialog (showWarningMessage({ modal: true })).
      const deleteConfirmation = page.locator('.monaco-dialog-box, .dialog-shadow').first();
      await expect(deleteConfirmation).toBeVisible({ timeout: 10_000 });
      await expect(deleteConfirmation).toContainText(messages.delete_source_confirmation_message);
      await clickModalDialogButton(page, messages.confirm_delete_source_button_text);

      await waitForOutputChannelText(page, { expectedText: 'Deleting', timeout: 30_000 });
      await waitForOutputChannelText(page, { expectedText: 'Deleted Source', timeout: DEPLOY_TIMEOUT });
      await saveScreenshot(page, 'nonTrackingDeployRetrieveOps.container.06-deleted.png');

      // File should leave the explorer (desktop explorer refresh can lag, so poll).
      await expect(async () => {
        expect(
          await page
            .locator('[role="treeitem"]')
            .filter({ hasText: new RegExp(`${className}\\.cls$`, 'i') })
            .count(),
          `File ${className}.cls should not be in explorer after delete from org`
        ).toBe(0);
      }).toPass({ timeout: 60_000 });
      await saveScreenshot(page, 'nonTrackingDeployRetrieveOps.container.07-removed-from-explorer.png');
    });
  } finally {
    // REQUIRED save/restore so later container specs run against the boot org. The throwaway class was
    // already deleted above; close editors so the restore interacts only with the status bar picker.
    await page.keyboard.press('Escape').catch(() => {});
    await closeAllEditors(page).catch(() => {});
    if (switchedToExtra) {
      await test.step('restore default org back to the boot org', async () => {
        // Re-drives the picker if the restore doesn't take, so the shared serial session isn't left
        // on nonTrackingTestOrg (which cascades into the next spec's pre-switch assertion).
        await switchDefaultOrgViaPicker(page, {
          fromLabel: NON_TRACKING_ORG_ALIAS,
          filterText: bootOrgLabel,
          expectLabel: bootOrgLabel
        });
        await saveScreenshot(page, 'nonTrackingDeployRetrieveOps.container.08-restored-boot-org.png');
      });
    }
  }

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
