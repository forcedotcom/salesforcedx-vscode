/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the Deploy Source in Manifest entry points. The web twin
 * (deployManifest.headless.spec.ts) proves the command is reachable from the manifest editor context
 * menu and the explorer file context menu against a plain Page. This proves each of those entry
 * points actually reaches the org from inside the Code Builder image using the container's
 * boot-authed org.
 *
 * Generates a uniquely-named manifest from the seeded fixture class (PagedResult.cls) so the shared
 * workbench does not collide across runs, deploys that manifest through each entry point, and asserts
 * each deploy runs to completion with no error notification.
 */

import { expect } from '@playwright/test';
import {
  captureOutputChannelDetails,
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  EDITOR,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  executeEditorContextMenuCommand,
  executeExplorerContextMenuCommand,
  NOTIFICATION_LIST_ITEM,
  openFileByName,
  openFileFromExplorerTree,
  activeQuickInputWidget,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { waitForDeployProgressNotificationToAppear } from '../../pages/notifications';
import { messages } from '../../../../src/messages/i18n';
import packageJson from '../../../../package.json';
import packageNls from '../../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../../constants';
import { containerTest as test } from '../../fixtures/containerFixtures';

/** Escape regex special characters in a string for use in RegExp */
const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('Deploy Manifest (Code Builder): deploys the fixture manifest via all entry points', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Unique per run so the shared, persistent workbench never overwrites an existing manifest.
  const manifestName = `deployManifest${Date.now()}`;

  const assertNoPostDeployError = async (screenshot: string): Promise<void> => {
    const escapedCompletedWithErrors = escapeRegex(messages.deploy_completed_with_errors_message);
    const escapedDeployFailed = escapeRegex(messages.deploy_failed.replaceAll('%s', '.*'));
    const pattern = new RegExp(`${escapedCompletedWithErrors}|${escapedDeployFailed}`, 'i');
    const errorNotification = page.locator(NOTIFICATION_LIST_ITEM).filter({ hasText: pattern }).first();
    const hasError = await errorNotification.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasError) {
      const errorText = await errorNotification.textContent();
      await captureOutputChannelDetails(page, packageJson.displayName, screenshot);
      throw new Error(`Deploy failed with error notification: ${errorText}`);
    }
  };

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'deployManifest.container.01-ready.png');
  });

  await test.step('generate manifest from the fixture class', async () => {
    await openFileFromExplorerTree(page, 'PagedResult.cls', ['force-app', 'main', 'default', 'classes']);
    const editor = page.locator('[data-uri*="PagedResult.cls"]').first();
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    await editor.click();

    await executeCommandWithCommandPalette(page, packageNls.project_generate_manifest_text);

    const quickInput = activeQuickInputWidget(page);
    await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
    await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'attached', timeout: 10_000 });

    // Type a unique manifest name (the .xml extension is added automatically).
    await page.keyboard.type(manifestName);
    await page.keyboard.press('Enter');

    const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${manifestName}.xml"]`).first();
    await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'deployManifest.container.02-manifest-generated.png');
  });

  await test.step('1. Editor context menu', async () => {
    await openFileByName(page, `${manifestName}.xml`);
    const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${manifestName}.xml"]`).first();
    await manifestEditor.waitFor({ state: 'visible', timeout: 10_000 });
    await manifestEditor.click();

    await executeEditorContextMenuCommand(page, packageNls.deploy_in_manifest_text, `manifest/${manifestName}.xml`);

    const deploying = await waitForDeployProgressNotificationToAppear(page, 30_000);
    await saveScreenshot(page, 'deployManifest.container.03-editor-deploying.png');
    await expect(deploying).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });
    await assertNoPostDeployError('deployManifest.container.editor-deploy-error.png');
    await saveScreenshot(page, 'deployManifest.container.04-editor-deployed.png');
  });

  await test.step('2. Explorer context menu (file)', async () => {
    await closeAllEditors(page);

    await executeExplorerContextMenuCommand(
      page,
      new RegExp(`${escapeRegex(manifestName)}\\.xml`),
      packageNls.deploy_in_manifest_text
    );

    const deploying = await waitForDeployProgressNotificationToAppear(page, 30_000);
    await saveScreenshot(page, 'deployManifest.container.05-explorer-deploying.png');
    await expect(deploying).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });
    await assertNoPostDeployError('deployManifest.container.explorer-deploy-error.png');
    await saveScreenshot(page, 'deployManifest.container.06-explorer-deployed.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
