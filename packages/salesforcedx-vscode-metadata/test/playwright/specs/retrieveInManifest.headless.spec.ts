/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers manifest-driven retrieve reachable from the editor context menu and the explorer file
 * context menu, asserted from the "Retrieved Source" output line. A throwaway class is deployed via a
 * generated manifest first so the manifest has something in the org to retrieve.
 *
 * Container: runs against the container's boot-authed org instead of a freshly created minimal org.
 * The throwaway class and manifest are uniquely named so the shared, persistent workbench never
 * collides with a prior run's files, and are removed (the class from the org too) after the test.
 */

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
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  upsertScratchOrgAuthFieldsToSettings,
  validateNoCriticalErrors,
  waitForOutputChannelText,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { messages } from '../../../src/messages/i18n';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT, RETRIEVE_TIMEOUT } from '../../constants';
import { isContainer, sharedTest as test } from '../fixtures';
import { cleanupContainerApexClasses, cleanupContainerFiles } from '../utils/containerCleanup';

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

test.setTimeout(RETRIEVE_TIMEOUT);

test('Retrieve In Manifest: retrieves via all entry points', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const stamp = Date.now();
  const className = `RetrieveManifestTest${stamp}`;
  const manifestFile = `retrieveManifest${stamp}.xml`;
  createdClasses.push(className);
  createdFiles.push(`manifest/${manifestFile}`);
  const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${manifestFile}"]`).first();

  // Start each operation from an empty Salesforce Metadata channel so its output waits can only match
  // that operation, not an earlier step's.
  const clearMetadataOutput = async (): Promise<void> => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);
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

    // The status bar appearing means the metadata extension has resolved the default org.
    const statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);
    await saveScreenshot(page, 'retrieveInManifest.01-ready.png');
  });

  await test.step('create apex class', async () => {
    // Opens the class editor, which "Generate Manifest File" below uses as its source.
    await createApexClass(page, className);
    await saveScreenshot(page, 'retrieveInManifest.02-class-created.png');
  });

  await test.step('generate manifest from apex class', async () => {
    await executeCommandWithCommandPalette(page, packageNls.project_generate_manifest_text);

    const quickInput = activeQuickInputWidget(page);
    await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
    await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'attached', timeout: 10_000 });

    // Replace the pre-selected default "package.xml" (the .xml extension is added automatically).
    await activeQuickInputTextField(page).fill(manifestFile.replace(/\.xml$/i, ''));
    await page.keyboard.press('Enter');

    await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'retrieveInManifest.03-manifest.png');
  });

  await test.step('deploy class to org via manifest', async () => {
    await clearMetadataOutput();
    await manifestEditor.click();
    await executeEditorContextMenuCommand(page, packageNls.deploy_in_manifest_text, `manifest/${manifestFile}`);

    // "Deployed Source" is printed only for a deploy that reached the org. The transient "Deploying"
    // toast is racy on a fast deploy, so completion is asserted via output alone.
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
    await saveScreenshot(page, 'retrieveInManifest.04-deployed.png');
  });

  await test.step('1. Editor context menu', async () => {
    await clearMetadataOutput();
    await manifestEditor.click();

    // Right-click the manifest editor → "SFDX: Retrieve Source in Manifest from Org"
    await executeEditorContextMenuCommand(page, packageNls.retrieve_in_manifest_text, `manifest/${manifestFile}`);

    await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
    await waitForOutputChannelText(page, { expectedText: 'Retrieved Source', timeout: RETRIEVE_TIMEOUT });
    await saveScreenshot(page, 'retrieveInManifest.05-editor-retrieve.png');
  });

  await test.step('2. Explorer context menu (file)', async () => {
    // Close any open editors so the command runs from the explorer selection alone
    await closeAllEditors(page);
    await clearMetadataOutput();

    // Right-click manifest in explorer → "SFDX: Retrieve Source in Manifest from Org"
    await executeExplorerContextMenuCommand(
      page,
      new RegExp(manifestFile.replaceAll('.', '\\.'), 'i'),
      packageNls.retrieve_in_manifest_text
    );

    await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
    await waitForOutputChannelText(page, { expectedText: 'Retrieved Source', timeout: RETRIEVE_TIMEOUT });
    await saveScreenshot(page, 'retrieveInManifest.06-explorer-retrieve.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
