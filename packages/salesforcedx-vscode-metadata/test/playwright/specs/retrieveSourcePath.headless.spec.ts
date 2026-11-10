/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers retrieving a file via the explorer context menu: a throwaway class is deployed, edited locally,
 * then retrieved, asserted from the "Retrieved Source" output line and the local change clearing from
 * the source-tracking status bar.
 *
 * Container: runs against the container's boot-authed org instead of a freshly created minimal org.
 * The throwaway class is uniquely named and removed (from the org too) after the test, and the local
 * counts are asserted relative to their starting value since the shared workbench may already hold
 * other local changes.
 */

import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createMinimalOrg,
  upsertScratchOrgAuthFieldsToSettings,
  createApexClass,
  editOpenFile,
  openFileByName,
  executeExplorerContextMenuCommand,
  executeCommandWithCommandPalette,
  validateNoCriticalErrors,
  saveScreenshot,
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  ensureSecondarySideBarHidden,
  resetContainerWorkbench
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT, RETRIEVE_TIMEOUT } from '../../constants';
import { isContainer, sharedTest as test } from '../fixtures';
import { cleanupContainerApexClasses } from '../utils/containerCleanup';

// Container-only: throwaway classes this test created, deleted from the project and org after it (pass
// or fail) so they don't pile up on the shared workbench — see utils/containerCleanup.
const createdClasses: string[] = [];

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
  test.afterEach(() => {
    cleanupContainerApexClasses(createdClasses.splice(0));
  });
}

test('Retrieve Source Path: retrieves file via explorer context menu', async ({ page }) => {
  test.setTimeout(RETRIEVE_TIMEOUT);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const className = `RetrieveSourcePathTest${Date.now()}`;
  createdClasses.push(className);
  const statusBarPage = new SourceTrackingStatusBarPage(page);
  let initialLocalCount: number;

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

    await statusBarPage.waitForVisible(120_000);
    initialLocalCount = (await statusBarPage.getCounts()).local;
    await saveScreenshot(page, 'retrieveSourcePath.01-ready.png');
  });

  await test.step('create apex class', async () => {
    await createApexClass(page, className);
    await statusBarPage.waitForCounts({ local: initialLocalCount + 1 }, 60_000);
    await saveScreenshot(page, 'retrieveSourcePath.02-class-created.png');
  });

  await test.step('deploy class to org so it exists to retrieve', async () => {
    await clearMetadataOutput();
    await openFileByName(page, `${className}.cls`);
    await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);

    // "Deployed Source" is printed only for a deploy that reached the org. The transient "Deploying"
    // toast is racy on a fast deploy, so completion is asserted via output alone.
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
    await statusBarPage.waitForCounts({ local: initialLocalCount }, 60_000);
    await saveScreenshot(page, 'retrieveSourcePath.03-deployed.png');
  });

  await test.step('edit class to create a local change', async () => {
    // The file now exists in the org but differs locally, so the retrieve has something to overwrite.
    await openFileByName(page, `${className}.cls`);
    await editOpenFile(page, 'Remote change simulation');
    await statusBarPage.waitForCounts({ local: initialLocalCount + 1 }, 60_000);
    await saveScreenshot(page, 'retrieveSourcePath.04-edited.png');
  });

  await test.step('retrieve file via explorer context menu', async () => {
    await clearMetadataOutput();

    // Right-click the apex class file in explorer and select retrieve
    const classFilePattern = new RegExp(`${className}\\.cls$`, 'i');
    await executeExplorerContextMenuCommand(page, classFilePattern, packageNls.retrieve_this_source_text);
    await saveScreenshot(page, 'retrieveSourcePath.05-after-context-menu.png');

    // Retrieve operations may not show progress notifications consistently across platforms, so
    // completion is asserted via the output channel.
    await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
    await waitForOutputChannelText(page, { expectedText: 'Retrieved Source', timeout: RETRIEVE_TIMEOUT });

    // The org's copy overwrote the local edit, so the class is no longer a local change.
    await statusBarPage.waitForCounts({ local: initialLocalCount }, 60_000);
    await saveScreenshot(page, 'retrieveSourcePath.06-retrieved.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
