/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for source deployment (ADR 0022). The web twin (deploySourcePath.headless.spec.ts)
 * proves the deploy command runs against a plain Page across its entry points; this proves a deploy
 * actually reaches the org from inside the Code Builder image, using the container's boot-authed org.
 *
 * Deploys the existing fixture class (no throwaway file, no source edit — so the shared mounted
 * fixture is not mutated) and asserts the deploy runs to completion with no error notification. That
 * exercises the full metadata/CLI path (extension → sf → org), the thing web mode cannot cover.
 */

import { expect } from '@playwright/test';
import {
  clearAllNotifications,
  clearOutputChannel,
  closeAllEditors,
  closeWelcomeTabs,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
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
import packageNls from '../../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../../constants';
import { containerTest as test } from '../../fixtures/containerFixtures';

test.beforeEach(async ({ page }) => {
  // Start from a clean workbench (matches the passing deploySourcePath twin): specs share one persistent
  // workbench, so leftover editors/notifications from a prior spec can push the fixture out of the
  // Explorer's virtual-scroll window and make the tree open flake.
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('Deploy Source (Code Builder): deploys the fixture class to the boot org', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'deploySource.container.01-ready.png');
  });

  await test.step('open the fixture class and focus its editor', async () => {
    // The Explorer tree open can transiently flake on the shared workbench (virtual scrolling / focus),
    // so retry the open+focus as a unit before relying on the editor being active.
    await expect(async () => {
      await openFileFromExplorerTree(page, 'PagedResult.cls', ['force-app', 'main', 'default', 'classes']);
      const editor = page.locator('[data-uri*="PagedResult.cls"]').first();
      await editor.waitFor({ state: 'visible', timeout: 15_000 });
      await editor.click();
    }).toPass({ timeout: 90_000, intervals: [1000, 2000, 5000] });
    await verifyCommandExists(page, packageNls.deploy_this_source_text, 60_000);
  });

  await test.step('deploy the active file and wait for completion', async () => {
    // Palette "Deploy This Source to Org" deploys the active editor's file to the default org. Assert
    // completion from the durable "Deployed Source" output-channel line rather than the transient
    // "Deploying" toast, which can flash past too fast to catch on a fast container deploy.
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);
    await saveScreenshot(page, 'deploySource.container.02-deploying.png');
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
    await saveScreenshot(page, 'deploySource.container.03-deployed.png');
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
