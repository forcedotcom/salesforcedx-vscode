/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers the Deploy Source in Manifest entry points: reachable from the manifest editor context menu
 * and the explorer file context menu, each deploying to completion with no error notification.
 *
 * Container: runs against the container's boot-authed org instead of a freshly created minimal org.
 * The throwaway class and manifest are uniquely named so the shared, persistent workbench never
 * collides with a prior run's files.
 */

import { expect } from '@playwright/test';
import {
  activeQuickInputWidget,
  captureOutputChannelDetails,
  clearOutputChannel,
  closeAllEditors,
  closeWelcomeTabs,
  createApexClass,
  createMinimalOrg,
  editOpenFile,
  EDITOR,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  executeEditorContextMenuCommand,
  executeExplorerContextMenuCommand,
  NOTIFICATION_LIST_ITEM,
  openFileFromExplorerTree,
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  upsertScratchOrgAuthFieldsToSettings,
  upsertSettings,
  validateNoCriticalErrors,
  waitForOutputChannelText,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import { messages } from '../../../src/messages/i18n';
import packageJson from '../../../package.json';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../constants';
import { isContainer, sharedTest as test } from '../fixtures';
import { cleanupContainerApexClasses, cleanupContainerFiles } from '../utils/containerCleanup';

/** Escape regex special characters in a string for use in RegExp */
const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Container-only: throwaway classes (deleted from the project and org) and generated manifests this test
// created, removed after it (pass or fail) so they don't pile up on the shared workbench — see utils/containerCleanup.
const createdClasses: string[] = [];
const createdFiles: string[] = [];

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
  test.afterEach(() => {
    cleanupContainerApexClasses(createdClasses.splice(0));
    cleanupContainerFiles(createdFiles.splice(0));
  });
}

test('Deploy Manifest: deploys via all entry points', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let className: string;
  let statusBarPage: SourceTrackingStatusBarPage;
  let initialLocalCount: number;
  // Unique per run so the container's shared, persistent workbench never overwrites an existing manifest.
  const manifestBaseName = `deployManifest${Date.now()}`;
  createdFiles.push(`manifest/${manifestBaseName}.xml`);

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

  const assertDeployingNotificationGone = async (timeoutMs: number): Promise<void> => {
    const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
    await expect(deployingNotification).not.toBeVisible({ timeout: timeoutMs });
  };

  // Clear the metadata output channel so the "Deployed Source" wait below only matches this deploy.
  const clearMetadataOutput = async (): Promise<void> => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);
  };

  const assertDeployCompleted = async (screenshots: {
    deploying: string;
    deployed: string;
    error: string;
  }): Promise<void> => {
    await assertDeployingNotificationGone(DEPLOY_TIMEOUT);
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
    await saveScreenshot(page, screenshots.deploying);
    await assertNoPostDeployError(screenshots.error);
    await statusBarPage.waitForCounts({ local: initialLocalCount }, 60_000);
    await saveScreenshot(page, screenshots.deployed);
  };

  const editApexClass = async (text: string): Promise<void> => {
    await openFileFromExplorerTree(page, `${className}.cls`, ['force-app', 'main', 'default', 'classes']);
    // Ensure the editor is focused before editing
    const apexEditor = page.locator(`[data-uri*="${className}.cls"]`).first();
    await apexEditor.waitFor({ state: 'visible', timeout: 10_000 });
    await apexEditor.click();
    await editOpenFile(page, text);
    await statusBarPage.waitForCounts({ local: initialLocalCount + 1 }, 60_000);
  };

  await test.step('setup', async () => {
    // The container's fixture already awaited the workbench, and its boot org is already authed.
    const createResult = isContainer ? undefined : await createMinimalOrg();
    if (!isContainer) {
      await waitForVSCodeWorkbench(page);
    }
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    if (createResult) {
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    }

    statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);

    if (!isContainer) {
      // Disable deploy-on-save so test can control when deploys happen
      await upsertSettings(page, { [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
    }
    await saveScreenshot(page, 'deployManifest.01-ready.png');
  });

  await test.step('prepare source file for manifest generation', async () => {
    // Get initial counts
    const initialCounts = await statusBarPage.getCounts();
    initialLocalCount = initialCounts.local;

    // Create apex class (so manifest has something to deploy)
    className = `DeployManifestTest${Date.now()}`;
    createdClasses.push(className);
    await createApexClass(page, className);

    // Verify local count incremented by 1
    await statusBarPage.waitForCounts({ local: initialLocalCount + 1 }, 60_000);
  });

  await test.step('generate manifest from apex class', async () => {
    // Generate manifest from the active editor (Apex class)
    await executeCommandWithCommandPalette(page, packageNls.project_generate_manifest_text);

    // Wait for input prompt
    const quickInput = activeQuickInputWidget(page);
    await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
    await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'attached', timeout: 10_000 });

    // Replace the pre-selected default "package.xml" (the .xml extension is added automatically).
    await page.keyboard.type(manifestBaseName);
    await page.keyboard.press('Enter');

    // Wait for manifest file to be created and opened
    const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${manifestBaseName}.xml"]`).first();
    await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'deployManifest.02-manifest-generated.png');
  });

  await test.step('1. Editor context menu', async () => {
    // Edit apex class to create local change
    await editApexClass('Editor context menu manifest test');

    await clearMetadataOutput();
    await openFileFromExplorerTree(page, `${manifestBaseName}.xml`, ['manifest']);

    // Ensure the manifest editor is focused and ready
    const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${manifestBaseName}.xml"]`).first();
    await manifestEditor.waitFor({ state: 'visible', timeout: 10_000 });
    await manifestEditor.click(); // Click to ensure focus

    // Right-click the manifest editor
    await executeEditorContextMenuCommand(page, packageNls.deploy_in_manifest_text, `manifest/${manifestBaseName}.xml`);

    // Check for deploy-related error notifications before waiting for deploying notification
    // Match deploy_failed message or file system errors (ENOENT, manifest issues)
    const allNotifications = page.locator(NOTIFICATION_LIST_ITEM);
    const escapedDeployFailedEarly = escapeRegex(messages.deploy_failed.replaceAll('%s', '.*'));
    const earlyDeployErrorPattern = new RegExp(`${escapedDeployFailedEarly}|ENOENT.*\\.xml|manifest`, 'i');
    const deployErrorNotification = allNotifications.filter({ hasText: earlyDeployErrorPattern }).first();
    const hasDeployError = await deployErrorNotification.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasDeployError) {
      const errorText = await deployErrorNotification.textContent();
      throw new Error(`Deploy failed with error notification: ${errorText}`);
    }

    await assertDeployCompleted({
      deploying: 'deployManifest.03-editor-deploying.png',
      deployed: 'deployManifest.04-editor-deployed.png',
      error: 'deploy-error-metadata-output.png'
    });
  });

  await test.step('2. Explorer context menu (file)', async () => {
    // Close any open editors to ensure clean state
    await closeAllEditors(page);

    // Edit apex class again to create new local change
    await editApexClass('Explorer context menu manifest test');

    await clearMetadataOutput();

    // Right-click manifest in explorer → "SFDX: Deploy Source in Manifest to Org"
    await executeExplorerContextMenuCommand(
      page,
      new RegExp(`${escapeRegex(manifestBaseName)}\\.xml`),
      packageNls.deploy_in_manifest_text
    );

    await assertDeployCompleted({
      deploying: 'deployManifest.05-explorer-deploying.png',
      deployed: 'deployManifest.06-explorer-deployed.png',
      error: 'deploy-error-metadata-output-step2.png'
    });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
