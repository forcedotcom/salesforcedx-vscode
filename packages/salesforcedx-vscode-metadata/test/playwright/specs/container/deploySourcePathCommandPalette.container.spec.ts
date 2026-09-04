/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the Deploy This Source command-palette entry point. The web twin
 * (deploySourcePathCommandPalette.headless.spec.ts) proves the palette command runs against a plain
 * Page for the active editor. This proves the same palette invocation actually reaches the org from
 * inside the Code Builder image using the container's boot-authed org.
 *
 * Deploys the seeded fixture class (ExampleClass.cls) as the active editor without editing it, so the
 * shared mounted fixture is not mutated, and asserts the deploy runs to completion with no error
 * notification.
 */

import { expect } from '@playwright/test';
import {
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
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

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('Deploy Source Path (Code Builder): deploys the active editor via command palette', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'deploySourcePathCommandPalette.container.01-ready.png');
  });

  await test.step('open the fixture class and focus its editor', async () => {
    await openFileFromExplorerTree(page, 'ExampleClass.cls', ['force-app', 'main', 'default', 'classes']);
    const editor = page.locator('[data-uri*="ExampleClass.cls"]').first();
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    await editor.click();
    await verifyCommandExists(page, packageNls.deploy_this_source_text, 60_000);
  });

  await test.step('deploy the active file via command palette and wait for completion', async () => {
    await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);

    const deploying = await waitForDeployProgressNotificationToAppear(page, 30_000);
    await saveScreenshot(page, 'deploySourcePathCommandPalette.container.02-deploying.png');
    await expect(deploying).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });
    await saveScreenshot(page, 'deploySourcePathCommandPalette.container.03-deployed.png');
  });

  await test.step('assert no deploy-error notification surfaced', async () => {
    const deployError = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /Failed to deploy|ENOENT|deploy.*failed/i })
      .first();
    const hasError = await deployError.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasError) {
      const text = await deployError.textContent();
      throw new Error(`Deploy failed with error notification: ${text}`);
    }
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
