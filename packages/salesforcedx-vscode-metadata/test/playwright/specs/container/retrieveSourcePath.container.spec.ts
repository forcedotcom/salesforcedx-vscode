/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for source retrieve. The web twin (retrieveSourcePath.headless.spec.ts)
 * proves the explorer-context-menu retrieve command runs against a plain Page; this proves a retrieve
 * actually reaches the org from inside the Code Builder image, using the container's boot-authed org.
 *
 * Retrieves the seeded fixture class (PagedResult.cls) rather than a throwaway/Dreamhouse class: it is
 * deployed to the boot org first (so it exists to retrieve) with no source edit, so the shared mounted
 * fixture is not mutated. Completion is asserted from the "Retrieved Source" output line — the full
 * metadata/CLI path (extension -> sf -> org) web mode cannot cover.
 */

import {
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  executeExplorerContextMenuCommand,
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
import packageNls from '../../../../package.nls.json';
import { DEPLOY_TIMEOUT, RETRIEVE_TIMEOUT } from '../../../constants';
import { containerTest as test } from '../../fixtures/containerFixtures';

const FIXTURE_CLASS = 'PagedResult';

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('Retrieve Source Path (Code Builder): retrieves the fixture class via explorer context menu', async ({ page }) => {
  test.setTimeout(RETRIEVE_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'retrieveSourcePath.container.01-ready.png');
  });

  await test.step('deploy the fixture class so it exists in the org to retrieve', async () => {
    // Path-based deploy of the unmodified seeded class: guarantees the ApexClass is present in the
    // boot org regardless of suite ordering, without editing the shared fixture on disk.
    await openFileFromExplorerTree(page, `${FIXTURE_CLASS}.cls`, ['force-app', 'main', 'default', 'classes']);
    const editor = page.locator(`[data-uri*="${FIXTURE_CLASS}.cls"]`).first();
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    await editor.click();
    await verifyCommandExists(page, packageNls.deploy_this_source_text, 60_000);

    await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);
    const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 60_000);
    await expect(deployingNotification).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });
    await saveScreenshot(page, 'retrieveSourcePath.container.02-deployed.png');
  });

  await test.step('retrieve the fixture class via explorer context menu', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);

    const classFilePattern = new RegExp(`${FIXTURE_CLASS}\\.cls$`, 'i');
    await executeExplorerContextMenuCommand(page, classFilePattern, packageNls.retrieve_this_source_text);
    await saveScreenshot(page, 'retrieveSourcePath.container.03-after-context-menu.png');

    // Retrieve operations may not surface a progress notification consistently across platforms; the
    // output channel is the reliable completion signal.
    await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
    await waitForOutputChannelText(page, { expectedText: 'Retrieved Source', timeout: RETRIEVE_TIMEOUT });
    await saveScreenshot(page, 'retrieveSourcePath.container.04-retrieved.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
