/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers deploy / retrieve / delete of a single class when the DEFAULT org has NO source tracking.
 *
 * Container: the container boots a source-TRACKING org as its default, so this uses the multi-org
 * capability (W-23898526): switch the DEFAULT to the second, NON-tracking org (nonTrackingTestOrg,
 * CB_EXTRA_ORG_ALIASES) via the status-bar picker, run the operations against it, and RESTORE the boot
 * org as default (REQUIRED) so the shared serial session is not contaminated — a genuinely different,
 * container-specific mechanism from desktop's per-run createNonTrackingOrg, so it is branched rather
 * than unified. The throwaway class is created only AFTER the non-tracking org is the default and is
 * removed BEFORE the boot org is restored, so no stray local change leaks into the tracking boot org.
 * Skips (never false-fails) when the extra org isn't authed.
 */

import { expect } from '@playwright/test';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createNonTrackingOrg,
  upsertScratchOrgAuthFieldsToSettings,
  upsertSettings,
  createApexClass,
  openFileByName,
  executeCommandWithCommandPalette,
  validateNoCriticalErrors,
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  isDesktop,
  NOTIFICATION_LIST_ITEM,
  clickModalDialogButton,
  ensureSecondarySideBarHidden,
  closeAllEditors,
  env,
  execAsync,
  expectOrgPickerStatusBar,
  MINIMAL_ORG_ALIAS,
  NON_TRACKING_ORG_ALIAS,
  resetContainerWorkbench,
  saveScreenshot,
  switchDefaultOrgViaPicker,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import { messages } from '../../../src/messages/i18n';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT, RETRIEVE_TIMEOUT } from '../../constants';
import { isContainer, sharedNonTrackingTest as test } from '../fixtures';

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

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
}

(isContainer || isDesktop() ? test : test.skip.bind(test))(
  'Non-Tracking Org: deploy/retrieve operations work without tracking',
  async ({ page }) => {
    test.setTimeout(RETRIEVE_TIMEOUT);

    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    let bootOrgLabel = '';
    let switchedToExtra = false;
    // Unique per run so the container's shared, persistent workbench never collides across runs.
    let className = isContainer ? `NonTrackingOpsTest${Date.now()}` : '';

    if (isContainer) {
      const bootOrgUsername = await resolveOrgUsername(MINIMAL_ORG_ALIAS).catch(() => undefined);
      const extraOrgAuthed = await resolveOrgUsername(NON_TRACKING_ORG_ALIAS).catch(() => undefined);

      test.skip(
        !bootOrgUsername || !extraOrgAuthed,
        `needs both "${MINIMAL_ORG_ALIAS}" (boot) and "${NON_TRACKING_ORG_ALIAS}" (CB_EXTRA_ORG_ALIASES) authed on the host`
      );
      bootOrgLabel = bootOrgUsername!;
    }

    await test.step('setup', async () => {
      if (isContainer) {
        // The containerTest fixture already awaited workbench readiness before handing over `page`.
        await closeWelcomeTabs(page);
        await ensureSecondarySideBarHidden(page);
        await saveScreenshot(page, 'nonTrackingDeployRetrieveOps.01-ready.png');
      } else {
        const createResult = await createNonTrackingOrg();
        await waitForVSCodeWorkbench(page);
        await closeWelcomeTabs(page);
        await ensureSecondarySideBarHidden(page);

        await upsertScratchOrgAuthFieldsToSettings(page, createResult);

        // Disable deploy-on-save so test can control when deploys happen
        await upsertSettings(page, { [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
      }
    });

    try {
      if (isContainer) {
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
          await saveScreenshot(page, 'nonTrackingDeployRetrieveOps.02-switched-to-nontracking.png');
        });
      }

      await test.step('create apex class', async () => {
        if (!isContainer) {
          className = `NonTrackingTest${Date.now()}`;
        }
        await createApexClass(page, className);

        if (isContainer) {
          const createdEditor = page.locator(`[data-uri*="${className}.cls"]`).first();
          await createdEditor.waitFor({ state: 'visible', timeout: 15_000 });
          await createdEditor.click();
          // The editor context keys (sf:in_package_directories) settle a beat after the file opens.
          await verifyCommandExists(page, messages.deploy_this_source_text, 60_000);
          await saveScreenshot(page, 'nonTrackingDeployRetrieveOps.03-created.png');
        }
      });

      await test.step('deploy class to org', async () => {
        await ensureOutputPanelOpen(page);
        await selectOutputChannel(page, 'Salesforce Metadata', isContainer ? 60_000 : undefined);
        await clearOutputChannel(page);
        await openFileByName(page, `${className}.cls`);

        await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);

        if (isContainer) {
          await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
          await saveScreenshot(page, 'nonTrackingDeployRetrieveOps.04-deployed.png');
        } else {
          const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
          await expect(deployingNotification).not.toBeVisible({ timeout: 240_000 });

          // Check for deploy error notifications
          const postDeployNotifications = page.locator(NOTIFICATION_LIST_ITEM);
          const deployErrorPattern = new RegExp(
            `${messages.deploy_completed_with_errors_message}|${messages.deploy_failed.replace('%s', '.*')}`,
            'i'
          );
          const deployErrorNotification = postDeployNotifications.filter({ hasText: deployErrorPattern }).first();
          const hasDeployError = await deployErrorNotification.isVisible({ timeout: 2000 }).catch(() => false);
          if (hasDeployError) {
            const errorText = await deployErrorNotification.textContent();
            throw new Error(`Deploy failed with error notification: ${errorText}`);
          }

          await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: 30_000 });
        }
      });

      await test.step('retrieve class from org', async () => {
        await ensureOutputPanelOpen(page);
        await selectOutputChannel(page, 'Salesforce Metadata', isContainer ? 60_000 : undefined);
        await clearOutputChannel(page);
        await openFileByName(page, `${className}.cls`);

        await executeCommandWithCommandPalette(page, packageNls.retrieve_this_source_text);

        await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
        await waitForOutputChannelText(page, { expectedText: 'Retrieved Source', timeout: RETRIEVE_TIMEOUT });
        if (isContainer) {
          await saveScreenshot(page, 'nonTrackingDeployRetrieveOps.05-retrieved.png');
        }
      });

      await test.step('delete class from org', async () => {
        await ensureOutputPanelOpen(page);
        await selectOutputChannel(page, 'Salesforce Metadata', isContainer ? 60_000 : undefined);
        await clearOutputChannel(page);
        await openFileByName(page, `${className}.cls`);

        await executeCommandWithCommandPalette(page, packageNls.delete_source_text);

        const deleteConfirmation = page.locator('.monaco-dialog-box, .dialog-shadow').first();
        await expect(deleteConfirmation).toBeVisible({ timeout: 10_000 });
        await expect(deleteConfirmation).toContainText(messages.delete_source_confirmation_message);
        await clickModalDialogButton(page, messages.confirm_delete_source_button_text);

        await waitForOutputChannelText(page, { expectedText: 'Deleting', timeout: 30_000 });
        await waitForOutputChannelText(page, { expectedText: 'Deleted Source', timeout: DEPLOY_TIMEOUT });
        if (isContainer) {
          await saveScreenshot(page, 'nonTrackingDeployRetrieveOps.06-deleted.png');
        }

        // Verify file was deleted from local filesystem (delete from org also deletes from project)
        await expect(async () => {
          const count = await page
            .locator('[role="treeitem"]')
            .filter({ hasText: new RegExp(`${className}\\.cls$`, 'i') })
            .count();
          expect(count, `File ${className}.cls should not be in explorer after delete from org`).toBe(0);
        }).toPass({ timeout: isContainer ? 60_000 : 30_000 });
        if (isContainer) {
          await saveScreenshot(page, 'nonTrackingDeployRetrieveOps.07-removed-from-explorer.png');
        }
      });
    } finally {
      if (isContainer) {
        // REQUIRED save/restore so later container specs run against the boot org. The throwaway class
        // was already deleted above; close editors so the restore interacts only with the status bar
        // picker.
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
            await saveScreenshot(page, 'nonTrackingDeployRetrieveOps.08-restored-boot-org.png');
          });
        }
      }
    }

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
