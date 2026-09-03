/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the Deploy This Source entry points. The web twin
 * (deploySourcePath.headless.spec.ts) proves the command is reachable from the editor context menu,
 * the explorer file context menu, and the explorer folder context menu against a plain Page. This
 * proves each of those entry points actually reaches the org from inside the Code Builder image
 * using the container's boot-authed org.
 *
 * Deploys the seeded fixture class (PagedResult.cls) through each entry point without editing it, so
 * the shared mounted fixture is not mutated, and asserts each deploy runs to completion with no error
 * notification. Absolute source-tracking counts are intentionally not asserted because specs share
 * one persistent workbench and org.
 */

import { expect, type Page } from '@playwright/test';
import {
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeEditorContextMenuCommand,
  executeExplorerContextMenuCommand,
  NOTIFICATION_LIST_ITEM,
  openFileFromExplorerTree,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import { waitForDeployProgressNotificationToAppear } from '../../pages/notifications';
import packageNls from '../../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../../constants';
import { containerTest as test } from '../../fixtures/containerFixtures';

const CLASS_PATH = ['force-app', 'main', 'default', 'classes'];

/** Fail if a deploy-error notification is present. */
const assertNoDeployError = async (page: Page): Promise<void> => {
  const deployError = page
    .locator(NOTIFICATION_LIST_ITEM)
    .filter({ hasText: /Failed to deploy|ENOENT|deploy.*failed/i })
    .first();
  const hasError = await deployError.isVisible({ timeout: 2000 }).catch(() => false);
  if (hasError) {
    const text = await deployError.textContent();
    throw new Error(`Deploy failed with error notification: ${text}`);
  }
};

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('Deploy Source Path (Code Builder): deploys the fixture class via all entry points', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'deploySourcePath.container.01-ready.png');
  });

  await test.step('1. Editor context menu', async () => {
    await openFileFromExplorerTree(page, 'PagedResult.cls', CLASS_PATH);
    const editor = page.locator('[data-uri*="PagedResult.cls"]').first();
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    await editor.click();
    await verifyCommandExists(page, packageNls.deploy_this_source_text, 60_000);

    await executeEditorContextMenuCommand(page, packageNls.deploy_this_source_text, 'PagedResult.cls');
    const deploying = await waitForDeployProgressNotificationToAppear(page, 30_000);
    await saveScreenshot(page, 'deploySourcePath.container.02-editor-deploying.png');
    await expect(deploying).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });
    await assertNoDeployError(page);
    await saveScreenshot(page, 'deploySourcePath.container.03-editor-deployed.png');
  });

  await test.step('2. Explorer context menu (file)', async () => {
    await closeAllEditors(page);
    // Match .cls but not .cls-meta.xml
    await executeExplorerContextMenuCommand(
      page,
      new RegExp('PagedResult\\.cls(?!-meta\\.xml)'),
      packageNls.deploy_this_source_text
    );
    const deploying = await waitForDeployProgressNotificationToAppear(page, 30_000);
    await saveScreenshot(page, 'deploySourcePath.container.04-explorer-file-deploying.png');
    await expect(deploying).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });
    await assertNoDeployError(page);
    await saveScreenshot(page, 'deploySourcePath.container.05-explorer-file-deployed.png');
  });

  await test.step('3. Explorer context menu (directory)', async () => {
    await closeAllEditors(page);
    // Right-click the "classes" folder → deploys the whole directory.
    await executeExplorerContextMenuCommand(page, /classes/i, packageNls.deploy_this_source_text);
    const deploying = await waitForDeployProgressNotificationToAppear(page, 30_000);
    await saveScreenshot(page, 'deploySourcePath.container.06-explorer-dir-deploying.png');
    await expect(deploying).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });
    await assertNoDeployError(page);
    await saveScreenshot(page, 'deploySourcePath.container.07-explorer-dir-deployed.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
