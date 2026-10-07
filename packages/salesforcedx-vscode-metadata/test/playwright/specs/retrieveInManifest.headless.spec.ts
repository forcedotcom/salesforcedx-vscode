/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers manifest-driven retrieve reachable from the editor context menu and the explorer file
 * context menu, asserted from the "Retrieved Source" output line.
 *
 * Container: generates the manifest from the seeded fixture class (PagedResult.cls, deployed first
 * directly so it exists to retrieve) under a unique name, rather than creating+deploying a throwaway
 * class via a manifest as desktop does — a genuinely different sequence, so it is branched rather than
 * unified.
 */

import { expect } from '@playwright/test';
import {
  activeQuickInputTextField,
  activeQuickInputWidget,
  clearOutputChannel,
  closeAllEditors,
  closeWelcomeTabs,
  createApexClass,
  createMinimalOrg,
  EDITOR,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  executeEditorContextMenuCommand,
  executeExplorerContextMenuCommand,
  focusOnFilesExplorer,
  NOTIFICATION_LIST_ITEM,
  openFileByName,
  openFileFromExplorerTree,
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  upsertScratchOrgAuthFieldsToSettings,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { messages } from '../../../src/messages/i18n';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT, RETRIEVE_TIMEOUT } from '../../constants';
import { isContainer, sharedTest as test } from '../fixtures';

const FIXTURE_CLASS = 'PagedResult';

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
}

test.setTimeout(RETRIEVE_TIMEOUT);

test('Retrieve In Manifest: retrieves via all entry points', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let className: string;
  let statusBarPage: SourceTrackingStatusBarPage;
  // Unique per run so the container's shared, persistent workbench never overwrites an existing
  // manifest; desktop/headless accept the default "package.xml" since each run gets a fresh project.
  const manifestFile = isContainer ? `pkgContainer${Date.now()}.xml` : 'package.xml';

  await test.step('setup', async () => {
    if (isContainer) {
      // The containerTest fixture already awaited workbench readiness before handing over `page`.
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await saveScreenshot(page, 'retrieveInManifest.01-ready.png');
    } else {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await saveScreenshot(page, 'setup.after-workbench.png');
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
      await saveScreenshot(page, 'setup.after-auth-fields.png');

      statusBarPage = new SourceTrackingStatusBarPage(page);
      await statusBarPage.waitForVisible(120_000);
      await saveScreenshot(page, 'setup.after-status-bar-visible.png');
    }
  });

  const prepareManifestContainer = async (): Promise<void> => {
    await test.step('deploy the fixture class so it exists in the org to retrieve', async () => {
      // A prior spec may have left a different sidebar view (e.g. Search) focused; the Files Explorer
      // tree needs to be the active view before locating items in it.
      await focusOnFilesExplorer(page);
      // The Explorer tree open can transiently flake on the shared workbench (virtual scrolling /
      // focus), so retry the open+focus as a unit.
      await expect(async () => {
        await openFileFromExplorerTree(page, `${FIXTURE_CLASS}.cls`, ['force-app', 'main', 'default', 'classes']);
        const editor = page.locator(`[data-uri*="${FIXTURE_CLASS}.cls"]`).first();
        await editor.waitFor({ state: 'visible', timeout: 15_000 });
        await editor.click();
      }).toPass({ timeout: 90_000, intervals: [1000, 2000, 5000] });
      await verifyCommandExists(page, packageNls.deploy_this_source_text, 60_000);

      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
      await clearOutputChannel(page);

      await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);
      // The transient "Deploying" toast is racy on a shared org where the class may already be present;
      // assert deploy completion via the output channel instead.
      await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
      await saveScreenshot(page, 'retrieveInManifest.02-deployed.png');
    });

    await test.step('generate a manifest from the fixture class', async () => {
      // The deploy step's output-channel work (ensureOutputPanelOpen/selectOutputChannel) left the
      // Output panel active, not the fixture class editor — "Generate Manifest File" falls back to the
      // active editor's URI when invoked with no explorer selection, so without re-focusing it here the
      // command finds no active editor and silently no-ops (shows an error message, never opens the
      // filename prompt).
      const editor = page.locator(`[data-uri*="${FIXTURE_CLASS}.cls"]`).first();
      await editor.click();
      await executeCommandWithCommandPalette(page, packageNls.project_generate_manifest_text);

      const quickInput = activeQuickInputWidget(page);
      await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
      await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'attached', timeout: 10_000 });

      await activeQuickInputTextField(page).fill(manifestFile.replace(/\.xml$/i, ''));
      await page.keyboard.press('Enter');

      const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${manifestFile}"]`).first();
      await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
      await saveScreenshot(page, 'retrieveInManifest.03-manifest.png');
    });
  };
  const prepareManifestDesktop = async (): Promise<void> => {
    await test.step('create apex class', async () => {
      // Create apex class (opens editor automatically)
      className = `RetrieveManifestTest${Date.now()}`;
      await createApexClass(page, className);
      await saveScreenshot(page, 'setup.after-create-class.png');
    });

    await test.step('generate manifest from apex class', async () => {
      // Generate manifest from the active editor (Apex class)
      await executeCommandWithCommandPalette(page, packageNls.project_generate_manifest_text);

      // Wait for input prompt
      const quickInput = activeQuickInputWidget(page);
      await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
      await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'attached', timeout: 10_000 });

      // Accept default filename (package.xml) by pressing Enter
      await page.keyboard.press('Enter');

      // Wait for manifest file to be created and opened
      const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${manifestFile}"]`).first();
      await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
    });

    await test.step('deploy class to org', async () => {
      // Open the manifest file
      await openFileByName(page, manifestFile);

      // Ensure the manifest editor is focused and ready
      const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${manifestFile}"]`).first();
      await manifestEditor.waitFor({ state: 'visible', timeout: 10_000 });
      await manifestEditor.click();

      // Deploy the manifest to push the class to the org
      await executeEditorContextMenuCommand(page, packageNls.deploy_in_manifest_text, `manifest/${manifestFile}`);

      // Verify deploy completes
      const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
      await expect(deployingNotification).not.toBeVisible({ timeout: RETRIEVE_TIMEOUT });

      // Check for deploy error notifications
      const postDeployNotifications = page.locator(NOTIFICATION_LIST_ITEM);
      const deployErrorPattern = new RegExp(
        `${messages.deploy_completed_with_errors_message}|${messages.deploy_failed.replaceAll('%s', '.*')}`,
        'i'
      );
      const deployErrorNotification = postDeployNotifications.filter({ hasText: deployErrorPattern }).first();
      const hasDeployError = await deployErrorNotification.isVisible({ timeout: 2000 }).catch(() => false);
      if (hasDeployError) {
        const errorText = await deployErrorNotification.textContent();
        throw new Error(`Deploy failed with error notification: ${errorText}`);
      }
    });
  };
  await (isContainer ? prepareManifestContainer : prepareManifestDesktop)();

  await test.step('1. Editor context menu', async () => {
    if (isContainer) {
      const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${manifestFile}"]`).first();
      await manifestEditor.waitFor({ state: 'visible', timeout: 10_000 });
      await manifestEditor.click();
    } else {
      // Open the manifest file (Quick Open shows just "package.xml")
      await openFileByName(page, manifestFile);

      // Ensure the manifest editor is focused and ready
      const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${manifestFile}"]`).first();
      await manifestEditor.waitFor({ state: 'visible', timeout: 10_000 });
      await manifestEditor.click();
    }

    // Prepare output channel before triggering command
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', isContainer ? 60_000 : undefined);

    // Right-click the manifest editor → "SFDX: Retrieve Source in Manifest from Org"
    await executeEditorContextMenuCommand(page, packageNls.retrieve_in_manifest_text, `manifest/${manifestFile}`);

    // Verify retrieve starts and completes via output channel
    await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
    await waitForOutputChannelText(page, { expectedText: 'Retrieved Source', timeout: RETRIEVE_TIMEOUT });
    if (isContainer) {
      await saveScreenshot(page, 'retrieveInManifest.04-editor-retrieve.png');
    }
  });

  await test.step('2. Explorer context menu (file)', async () => {
    // Close any open editors to ensure clean state
    await closeAllEditors(page);

    // Prepare output channel
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', isContainer ? 60_000 : undefined);

    // Right-click manifest in explorer → "SFDX: Retrieve Source in Manifest from Org"
    await executeExplorerContextMenuCommand(
      page,
      isContainer ? new RegExp(manifestFile.replaceAll('.', '\\.'), 'i') : /package\.xml/i,
      packageNls.retrieve_in_manifest_text
    );

    // Verify retrieve starts and completes via output channel
    await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
    await waitForOutputChannelText(page, { expectedText: 'Retrieved Source', timeout: RETRIEVE_TIMEOUT });
    if (isContainer) {
      await saveScreenshot(page, 'retrieveInManifest.05-explorer-retrieve.png');
    }
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
