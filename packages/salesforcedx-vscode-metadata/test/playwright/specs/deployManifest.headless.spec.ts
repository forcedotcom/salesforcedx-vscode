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
 * Container: runs against the container's boot-authed org and the seeded fixture class
 * (PagedResult.cls) instead of creating a throwaway apex class, since the deploy targets the manifest
 * contents directly rather than a local-change diff. Generates a uniquely-named manifest so the
 * shared, persistent workbench never overwrites an existing manifest across runs.
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
  openFileByName,
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

/** Escape regex special characters in a string for use in RegExp */
const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
}

test('Deploy Manifest: deploys via all entry points', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let className: string;
  let statusBarPage: SourceTrackingStatusBarPage;
  let initialLocalCount: number;
  // Unique per run so the container's shared, persistent workbench never overwrites an existing
  // manifest. Desktop/headless accept the default "package.xml" filename since each run gets a fresh
  // project.
  const manifestBaseName = isContainer ? `deployManifest${Date.now()}` : 'package';

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

  await test.step('setup', async () => {
    if (isContainer) {
      // The containerTest fixture already awaited workbench readiness before handing over `page`.
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await saveScreenshot(page, 'deployManifest.01-ready.png');
    } else {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);

      statusBarPage = new SourceTrackingStatusBarPage(page);
      await statusBarPage.waitForVisible(120_000);

      // Disable deploy-on-save so test can control when deploys happen
      await upsertSettings(page, { [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
    }
  });

  await test.step('prepare source file for manifest generation', async () => {
    const prepareApexClassContainer = async (): Promise<void> => {
      // Use the seeded fixture class rather than mutating the shared workbench with a new one.
      // The Explorer tree open can transiently flake on the shared workbench (virtual scrolling /
      // focus), so retry the open+focus as a unit.
      await expect(async () => {
        await openFileFromExplorerTree(page, 'PagedResult.cls', ['force-app', 'main', 'default', 'classes']);
        const editor = page.locator('[data-uri*="PagedResult.cls"]').first();
        await editor.waitFor({ state: 'visible', timeout: 15_000 });
        await editor.click();
      }).toPass({ timeout: 90_000, intervals: [1000, 2000, 5000] });
    };
    const prepareApexClassDesktop = async (): Promise<void> => {
      // Get initial counts
      const initialCounts = await statusBarPage.getCounts();
      initialLocalCount = initialCounts.local;

      // Create apex class (so manifest has something to deploy)
      className = `DeployManifestTest${Date.now()}`;
      await createApexClass(page, className);

      // Verify local count incremented by 1
      await statusBarPage.waitForCounts({ local: initialLocalCount + 1 }, 60_000);
    };
    await (isContainer ? prepareApexClassContainer : prepareApexClassDesktop)();
  });

  await test.step('generate manifest from apex class', async () => {
    // Generate manifest from the active editor (Apex class)
    await executeCommandWithCommandPalette(page, packageNls.project_generate_manifest_text);

    // Wait for input prompt
    const quickInput = activeQuickInputWidget(page);
    await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
    await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'attached', timeout: 10_000 });

    if (isContainer) {
      // Type a unique manifest name (the .xml extension is added automatically).
      await page.keyboard.type(manifestBaseName);
    }
    // Accept the filename (default "package.xml" on desktop, the typed unique name in the container)
    await page.keyboard.press('Enter');

    // Wait for manifest file to be created and opened
    const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${manifestBaseName}.xml"]`).first();
    await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
    if (isContainer) {
      await saveScreenshot(page, 'deployManifest.02-manifest-generated.png');
    }
  });

  await test.step('1. Editor context menu', async () => {
    if (isContainer) {
      await openFileByName(page, `${manifestBaseName}.xml`);
    } else {
      // Edit apex class to create local change
      await openFileFromExplorerTree(page, `${className}.cls`, ['force-app', 'main', 'default', 'classes']);

      await editOpenFile(page, 'Editor context menu manifest test');
      await statusBarPage.waitForCounts({ local: initialLocalCount + 1 }, 60_000);

      await openFileFromExplorerTree(page, `${manifestBaseName}.xml`, ['manifest']);
    }

    // Ensure the manifest editor is focused and ready
    const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${manifestBaseName}.xml"]`).first();
    await manifestEditor.waitFor({ state: 'visible', timeout: 10_000 });
    await manifestEditor.click(); // Click to ensure focus

    if (isContainer) {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
      await clearOutputChannel(page);
    }

    // Right-click the manifest editor
    await executeEditorContextMenuCommand(page, packageNls.deploy_in_manifest_text, `manifest/${manifestBaseName}.xml`);

    if (!isContainer) {
      // Check for deploy-related error notifications before waiting for deploying notification
      // Match deploy_failed message or file system errors (ENOENT, manifest issues)
      const allNotifications = page.locator(NOTIFICATION_LIST_ITEM);
      const escapedDeployFailedEarly = escapeRegex(messages.deploy_failed.replaceAll('%s', '.*'));
      const earlyDeployErrorPattern = new RegExp(`${escapedDeployFailedEarly}|ENOENT.*package\\.xml|manifest`, 'i');
      const deployErrorNotification = allNotifications.filter({ hasText: earlyDeployErrorPattern }).first();
      const hasDeployError = await deployErrorNotification.isVisible({ timeout: 2000 }).catch(() => false);
      if (hasDeployError) {
        const errorText = await deployErrorNotification.textContent();
        throw new Error(`Deploy failed with error notification: ${errorText}`);
      }
    }

    if (isContainer) {
      // The transient "Deploying" toast can flash past too fast to catch on a fast container deploy;
      // assert completion via the output channel instead.
      await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
      await saveScreenshot(page, 'deployManifest.03-editor-deploying.png');
      await assertNoPostDeployError('deploy-error-metadata-output.png');
      await saveScreenshot(page, 'deployManifest.04-editor-deployed.png');
    } else {
      // Verify deploy completes - look for deploying notification
      await assertDeployingNotificationGone(DEPLOY_TIMEOUT);
      await assertNoPostDeployError('deploy-error-metadata-output.png');
      await statusBarPage.waitForCounts({ local: initialLocalCount }, 60_000);
    }
  });

  await test.step('2. Explorer context menu (file)', async () => {
    // Close any open editors to ensure clean state
    await closeAllEditors(page);

    if (isContainer) {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
      await clearOutputChannel(page);
      await executeExplorerContextMenuCommand(
        page,
        new RegExp(`${escapeRegex(manifestBaseName)}\\.xml`),
        packageNls.deploy_in_manifest_text
      );
      // The transient "Deploying" toast can flash past too fast to catch on a fast container deploy;
      // assert completion via the output channel instead.
      await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
      await saveScreenshot(page, 'deployManifest.05-explorer-deploying.png');
    } else {
      // Edit apex class again to create new local change
      await openFileFromExplorerTree(page, `${className}.cls`, ['force-app', 'main', 'default', 'classes']);
      // Ensure the editor is focused before editing
      const apexEditor = page.locator(`[data-uri*="${className}.cls"]`).first();
      await apexEditor.waitFor({ state: 'visible', timeout: 10_000 });
      await apexEditor.click();
      await editOpenFile(page, 'Explorer context menu manifest test');
      await statusBarPage.waitForCounts({ local: initialLocalCount + 1 }, 60_000);

      // Right-click manifest in explorer → "SFDX: Deploy Source in Manifest to Org"
      await executeExplorerContextMenuCommand(page, /package\.xml/i, packageNls.deploy_in_manifest_text);

      // Verify deploy completes
      await assertDeployingNotificationGone(DEPLOY_TIMEOUT);
    }

    await assertNoPostDeployError('deploy-error-metadata-output-step2.png');

    if (isContainer) {
      await saveScreenshot(page, 'deployManifest.06-explorer-deployed.png');
    } else {
      await statusBarPage.waitForCounts({ local: initialLocalCount }, 60_000);
    }
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
