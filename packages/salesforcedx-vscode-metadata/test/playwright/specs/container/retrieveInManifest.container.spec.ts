/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for retrieve-in-manifest. The web twin (retrieveInManifest.headless.spec.ts)
 * proves the retrieve-in-manifest command runs against a plain Page across its entry points; this proves
 * a manifest-driven retrieve actually reaches the org from inside the Code Builder image, using the
 * container's boot-authed org.
 *
 * Generates a manifest from the seeded fixture class (PagedResult.cls, deployed first so it exists to
 * retrieve) under a unique name, then retrieves via editor and explorer context menus. Completion is
 * asserted from the "Retrieved Source" output line — the full metadata/CLI path (extension -> sf -> org)
 * web mode cannot cover.
 */

import {
  activeQuickInputTextField,
  activeQuickInputWidget,
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  EDITOR,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  executeEditorContextMenuCommand,
  executeExplorerContextMenuCommand,
  NOTIFICATION_LIST_ITEM,
  openFileFromExplorerTree,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { expect } from '@playwright/test';
import { waitForDeployProgressNotificationToAppear } from '../../pages/notifications';
import { messages } from '../../../../src/messages/i18n';
import packageNls from '../../../../package.nls.json';
import { DEPLOY_TIMEOUT, RETRIEVE_TIMEOUT } from '../../../constants';
import { containerTest as test } from '../../fixtures/containerFixtures';

const FIXTURE_CLASS = 'PagedResult';

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('Retrieve In Manifest (Code Builder): retrieves via editor and explorer entry points', async ({ page }) => {
  test.setTimeout(RETRIEVE_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Unique manifest name avoids the overwrite modal and collisions in the shared persistent workbench.
  const manifestFile = `pkgContainer${Date.now()}.xml`;

  await test.step('workbench ready', async () => {
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'retrieveInManifest.container.01-ready.png');
  });

  await test.step('deploy the fixture class so it exists in the org to retrieve', async () => {
    await openFileFromExplorerTree(page, `${FIXTURE_CLASS}.cls`, ['force-app', 'main', 'default', 'classes']);
    const editor = page.locator(`[data-uri*="${FIXTURE_CLASS}.cls"]`).first();
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    await editor.click();
    await verifyCommandExists(page, packageNls.deploy_this_source_text, 60_000);

    await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);
    const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 60_000);
    await expect(deployingNotification).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });

    const deployError = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /Failed to deploy|deploy.*failed/i })
      .first();
    const hasError = await deployError.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasError) {
      throw new Error(`Deploy failed with error notification: ${await deployError.textContent()}`);
    }
    await saveScreenshot(page, 'retrieveInManifest.container.02-deployed.png');
  });

  await test.step('generate a manifest from the fixture class', async () => {
    // The fixture class editor is still active from the deploy step; generate the manifest from it.
    await executeCommandWithCommandPalette(page, packageNls.project_generate_manifest_text);

    const quickInput = activeQuickInputWidget(page);
    await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
    await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'attached', timeout: 10_000 });

    await activeQuickInputTextField(page).fill(manifestFile.replace(/\.xml$/i, ''));
    await page.keyboard.press('Enter');

    const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${manifestFile}"]`).first();
    await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'retrieveInManifest.container.03-manifest.png');
  });

  await test.step('1. Editor context menu', async () => {
    const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${manifestFile}"]`).first();
    await manifestEditor.waitFor({ state: 'visible', timeout: 10_000 });
    await manifestEditor.click();

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);

    await executeEditorContextMenuCommand(page, packageNls.retrieve_in_manifest_text, `manifest/${manifestFile}`);

    await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
    await waitForOutputChannelText(page, { expectedText: 'Retrieved Source', timeout: RETRIEVE_TIMEOUT });
    await saveScreenshot(page, 'retrieveInManifest.container.04-editor-retrieve.png');
  });

  await test.step('2. Explorer context menu (file)', async () => {
    await closeAllEditors(page);

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);

    await executeExplorerContextMenuCommand(
      page,
      new RegExp(manifestFile.replaceAll('.', '\\.'), 'i'),
      packageNls.retrieve_in_manifest_text
    );

    await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
    await waitForOutputChannelText(page, { expectedText: 'Retrieved Source', timeout: RETRIEVE_TIMEOUT });
    await saveScreenshot(page, 'retrieveInManifest.container.05-explorer-retrieve.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
