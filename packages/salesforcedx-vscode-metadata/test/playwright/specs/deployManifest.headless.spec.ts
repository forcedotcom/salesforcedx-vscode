/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test } from '../fixtures';
import { expect } from '@playwright/test';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  filterErrors,
  filterNetworkErrors,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createMinimalOrg,
  upsertScratchOrgAuthFieldsToSettings,
  upsertSettings,
  createApexClass,
  editOpenFile,
  createFileWithContents,
  openFileByName,
  executeEditorContextMenuCommand,
  executeExplorerContextMenuCommand,
  executeCommandWithCommandPalette
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { METADATA_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import packageNls from '../../../package.nls.json';

const manifestContent = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>*</members>
    <name>ApexClass</name>
  </types>
  <version>65.0</version>
</Package>`;

test.describe('Deploy Manifest', () => {
  test('deploys via all entry points', async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    let className: string;
    let statusBarPage: SourceTrackingStatusBarPage;

    await test.step('setup minimal org and disable deploy-on-save', async () => {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);

      statusBarPage = new SourceTrackingStatusBarPage(page);
      await statusBarPage.waitForVisible(120_000);

      // Disable deploy-on-save so test can control when deploys happen
      await upsertSettings(page, { [`${METADATA_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });

      await closeWelcomeTabs(page);
    });

    await test.step('create apex class and manifest', async () => {
      // Create apex class (so manifest has something to deploy)
      className = `DeployManifestTest${Date.now()}`;
      await createApexClass(page, className);

      // Verify local count increments to 1
      await statusBarPage.waitForCounts({ local: 1 }, 60_000);

      // Create the manifest file at project root (no subfolder for simplicity)
      await createFileWithContents(page, 'package.xml', manifestContent);
    });

    await test.step('1. Editor context menu', async () => {
      // Edit apex class to create local change
      await openFileByName(page, `${className}.cls`);

      await editOpenFile(page, 'Editor context menu manifest test');
      await statusBarPage.waitForCounts({ local: 1 }, 60_000);

      // Open the manifest file (already created in previous step)
      await openFileByName(page, 'package.xml');

      // Ensure the manifest editor is focused and ready
      const manifestEditor = page.locator('.monaco-editor[data-uri*="package.xml"]').first();
      await manifestEditor.waitFor({ state: 'visible', timeout: 10_000 });
      await manifestEditor.click(); // Click to ensure focus

      // Right-click the manifest editor
      await executeEditorContextMenuCommand(page, packageNls.deploy_in_manifest_text, 'package.xml');

      // Check for deploy-related error notifications before waiting for deploying notification
      const allNotifications = page.locator('.monaco-workbench .notification-list-item');
      const deployErrorNotification = allNotifications
        .filter({ hasText: /Failed to deploy|ENOENT.*package\.xml|manifest/i })
        .first();
      const hasDeployError = await deployErrorNotification.isVisible({ timeout: 2000 }).catch(() => false);
      if (hasDeployError) {
        const errorText = await deployErrorNotification.textContent();
        throw new Error(`Deploy failed with error notification: ${errorText}`);
      }

      // Verify deploy completes - look for deploying notification
      const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
      await expect(deployingNotification).not.toBeVisible({ timeout: 240_000 });
      await statusBarPage.waitForCounts({ local: 0 }, 60_000);
    });

    await test.step('2. Explorer context menu (file)', async () => {
      // Close any open editors to ensure clean state
      await executeCommandWithCommandPalette(page, 'View: Close All Editors');

      // Edit apex class again to create new local change
      await openFileByName(page, `${className}.cls`);
      // Ensure the editor is focused before editing
      const apexEditor = page.locator(`[data-uri*="${className}.cls"]`).first();
      await apexEditor.waitFor({ state: 'visible', timeout: 10_000 });
      await apexEditor.click();
      await editOpenFile(page, 'Explorer context menu manifest test');
      await statusBarPage.waitForCounts({ local: 1 }, 60_000);

      // Right-click manifest in explorer → "SFDX: Deploy Source in Manifest to Org"
      await executeExplorerContextMenuCommand(page, /package\.xml/i, packageNls.deploy_in_manifest_text);

      // Verify deploy completes
      const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
      await expect(deployingNotification).not.toBeVisible({ timeout: 240_000 });
      await statusBarPage.waitForCounts({ local: 0 }, 60_000);
    });

    await test.step('validate no critical errors', async () => {
      const criticalConsole = filterErrors(consoleErrors);
      const criticalNetwork = filterNetworkErrors(networkErrors);
      expect(criticalConsole, `Console errors: ${criticalConsole.map(e => e.text).join(' | ')}`).toHaveLength(0);
      expect(criticalNetwork, `Network errors: ${criticalNetwork.map(e => e.description).join(' | ')}`).toHaveLength(0);
    });
  });
});
