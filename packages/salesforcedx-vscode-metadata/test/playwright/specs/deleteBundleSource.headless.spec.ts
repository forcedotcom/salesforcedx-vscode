/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * W-14707241 regression guard: "SFDX: Delete from Project and Org" launched from a single bundle child
 * file must delete the WHOLE bundle locally, not just the launched file. The original bug shelled out
 * `project:delete:source --source-dir .../AC.cmp`, which removed only the one file. Uses an LWC bundle
 * (`.js`, `.html`, `.js-meta.xml`) as the multi-file proxy for the Aura `.cmp` bundle in the report.
 *
 * The bundle is deployed first so the delete command's destructive deploy has a real component to remove
 * (deleting a never-deployed component errors "No LightningComponentBundle named X found" and leaves the
 * local files in place). The desktop workspace template ships a `.forceignore` for `__tests__`/jsconfig so
 * the LWC create wizard's scaffolded jest files don't break the deploy.
 *
 * Runs on web and desktop via the shared `test` fixture. "SFDX: Create Lightning Web Component" is
 * contributed by salesforcedx-vscode-lwc, loaded as an extra extension on both surfaces.
 */

import { test } from '../fixtures';
import { expect, type Page } from '@playwright/test';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createMinimalOrg,
  upsertScratchOrgAuthFieldsToSettings,
  upsertSettings,
  executeCommandWithCommandPalette,
  verifyCommandExists,
  validateNoCriticalErrors,
  saveScreenshot,
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  NOTIFICATION_LIST_ITEM,
  ensureSecondarySideBarHidden,
  QUICK_INPUT_WIDGET,
  QUICK_INPUT_LIST_ROW,
  EDITOR_WITH_URI,
  waitForQuickInputFirstOption,
  waitForExtensionsActivated,
  isDesktop
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import { nls } from '../../../src/messages';
import { DEPLOY_TIMEOUT } from '../../constants';

test.setTimeout(DEPLOY_TIMEOUT);

/** Contributed by salesforcedx-vscode-lwc (loaded as an extra extension on web + desktop). */
const CREATE_LWC_COMMAND = 'SFDX: Create Lightning Web Component';

const surface = (): string => (isDesktop() ? 'desktop' : 'web');

const treeItemFor = (page: Page, fileName: string) =>
  page.locator('[role="treeitem"]').filter({ hasText: new RegExp(`${fileName.replaceAll('.', '\\.')}$`, 'i') });

/** Run the Create-LWC wizard; leaves the bundle `.js` editor open. Mirrors lwcUtils.createLwcViaSfdxCommand. */
const createLwcBundle = async (page: Page, camelName: string): Promise<void> => {
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await verifyCommandExists(page, CREATE_LWC_COMMAND, 120_000);
  await executeCommandWithCommandPalette(page, CREATE_LWC_COMMAND);

  const quickInput = page.locator(QUICK_INPUT_WIDGET);
  await quickInput.waitFor({ state: 'visible', timeout: 30_000 });

  // Optional type picker (JS/TS) on newer versions
  const hasTypePicker = await quickInput
    .locator(QUICK_INPUT_LIST_ROW)
    .first()
    .waitFor({ state: 'visible', timeout: 2000 })
    .then(() => true)
    .catch(() => false);
  if (hasTypePicker) {
    await page.keyboard.press('Enter');
  }

  await quickInput.getByText(/Enter Lightning Web Component name/i).waitFor({ state: 'visible', timeout: 10_000 });
  await page.keyboard.type(camelName);
  await page.keyboard.press('Enter');

  await waitForQuickInputFirstOption(page, { optionVisibleTimeout: 15_000 });
  await page.keyboard.press('Enter');

  const jsEditor = page.locator(`${EDITOR_WITH_URI}[data-uri*="${camelName}.js"]`);
  await jsEditor.waitFor({ state: 'visible', timeout: 45_000 });
};

test('Delete Source: deletes entire LWC bundle from project and org when launched from one bundle file', async ({
  page
}) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const camelName = `deleteBundle${Date.now()}`;
  const bundleFiles = [`${camelName}.js`, `${camelName}.html`, `${camelName}.js-meta.xml`];
  let statusBarPage: SourceTrackingStatusBarPage;

  await test.step('setup minimal org and disable deploy-on-save', async () => {
    const createResult = await createMinimalOrg();
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);

    statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);

    // LWC extension contributes Create-LWC; wait for all extensions to activate so its command handler is live.
    await waitForExtensionsActivated(page);
    // Control when deploys happen (create should not auto-deploy)
    await upsertSettings(page, { [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
    await verifyCommandExists(page, CREATE_LWC_COMMAND, 30_000);
  });

  await test.step('create and deploy LWC bundle', async () => {
    await createLwcBundle(page, camelName);

    // Bundle counts as one changed component in source tracking
    await statusBarPage.waitForCounts({ local: 1 }, 60_000);

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');

    await executeCommandWithCommandPalette(page, nls.localize('deploy_this_source_text'));
    const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
    await expect(deployingNotification).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });
    await statusBarPage.waitForCounts({ local: 0 }, 60_000);
    await saveScreenshot(page, `bundle.after-deploy.${surface()}.png`);
  });

  await test.step('delete from one bundle file, expect whole bundle removed', async () => {
    // The .js editor is open (launched-from file). Run delete from it.
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, nls.localize('delete_source_text'));

    const deleteConfirmation = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: nls.localize('delete_source_confirmation_message') })
      .first();
    await expect(deleteConfirmation).toBeVisible({ timeout: 10_000 });
    await deleteConfirmation.getByRole('button', { name: nls.localize('confirm_delete_source_button_text') }).click();

    await waitForOutputChannelText(page, { expectedText: 'Deleting', timeout: 30_000 });
    await waitForOutputChannelText(page, { expectedText: 'Deleted Source', timeout: DEPLOY_TIMEOUT });

    // W-14707241: every bundle file must be gone from the explorer, not just the launched .js
    for (const file of bundleFiles) {
      await expect(async () => {
        expect(await treeItemFor(page, file).count(), `bundle file ${file} should be removed from explorer`).toBe(0);
      }).toPass({ timeout: 60_000 });
    }
    await saveScreenshot(page, `bundle.all-files-removed.${surface()}.png`);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
