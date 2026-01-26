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
  waitForVSCodeWorkbench,
  assertWelcomeTabExists,
  closeWelcomeTabs,
  createMinimalOrg,
  upsertScratchOrgAuthFieldsToSettings,
  upsertSettings,
  createApexClass,
  editOpenFile,
  openFileByName,
  executeCommandWithCommandPalette,
  executeExplorerContextMenuCommand,
  saveScreenshot,
  isMacDesktop,
  validateNoCriticalErrors,
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  outputChannelContains,
  EDITOR
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { METADATA_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../constants';

test('Source Diff: diff via command palette shows diff editor', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let className: string;
  let statusBarPage: SourceTrackingStatusBarPage;

  await test.step('setup minimal org and disable deploy-on-save', async () => {
    const createResult = await createMinimalOrg();
    await waitForVSCodeWorkbench(page);
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
    await saveScreenshot(page, 'setup.after-workbench.png');
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    await saveScreenshot(page, 'setup.after-auth-fields.png');

    statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);
    await saveScreenshot(page, 'setup.after-status-bar-visible.png');

    await upsertSettings(page, { [`${METADATA_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
    await saveScreenshot(page, 'setup.complete.png');
  });

  await test.step('create and deploy class', async () => {
    className = `SourceDiffTest${Date.now()}`;
    await createApexClass(page, className);
    await saveScreenshot(page, 'create-deploy.after-create-class.png');

    await statusBarPage.waitForCounts({ local: 1 }, 60_000);
    await saveScreenshot(page, 'create-deploy.after-local-count-1.png');

    await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);
    await saveScreenshot(page, 'create-deploy.after-deploy-command.png');

    const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
    await saveScreenshot(page, 'create-deploy.deploy-notification-appeared.png');
    await expect(deployingNotification).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });

    // Wait for deploy completion via output channel
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await waitForOutputChannelText(page, { expectedText: 'deployed', timeout: DEPLOY_TIMEOUT });
    await saveScreenshot(page, 'create-deploy.deploy-complete.png');
  });

  await test.step('create local change and diff via command palette', async () => {
    await executeCommandWithCommandPalette(page, 'View: Close All Editors');
    await saveScreenshot(page, 'diff-palette.after-close-editors.png');

    await openFileByName(page, `${className}.cls`);
    await saveScreenshot(page, 'diff-palette.after-open-file.png');

    const apexEditor = page.locator(`[data-uri*="${className}.cls"]`).first();
    await apexEditor.waitFor({ state: 'visible', timeout: 10_000 });
    await apexEditor.click();

    await editOpenFile(page, '// Local change for diff test');
    await saveScreenshot(page, 'diff-palette.after-edit.png');

    await statusBarPage.waitForCounts({ local: 1 }, 60_000);
    await saveScreenshot(page, 'diff-palette.after-local-count-1.png');

    // Ensure file is saved before diffing
    await page.keyboard.press('Control+s');
    await page.locator(EDITOR).first().waitFor({ state: 'visible', timeout: 5000 });
    await saveScreenshot(page, 'diff-palette.after-save.png');

    // Clear output and execute diff
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, packageNls.diff_source_against_org_text);
    await saveScreenshot(page, 'diff-palette.after-diff-command.png');

    // Wait for retrieving message
    await waitForOutputChannelText(page, { expectedText: 'Retrieving 1 component for diff...', timeout: 30_000 });
    await saveScreenshot(page, 'diff-palette.retrieving-message.png');

    // Wait for retrieve output (check for "Retrieved Source" or similar)
    await waitForOutputChannelText(page, { expectedText: 'Retrieved Source', timeout: DEPLOY_TIMEOUT });
    await saveScreenshot(page, 'diff-palette.after-retrieve.png');

    // Verify retrieve succeeded - check for failure messages
    const hasNoComponents = await outputChannelContains(page, '0 components retrieved');
    expect(hasNoComponents, 'Should not show "0 components retrieved"').toBe(false);

    const hasNoResults = await outputChannelContains(page, 'No components retrieved from org');
    expect(hasNoResults, 'Should not show "No components retrieved from org"').toBe(false);

    const hasNoMatchingFiles = await outputChannelContains(page, 'No matching files found to diff');
    expect(hasNoMatchingFiles, 'Should not show "No matching files found to diff"').toBe(false);

    // Wait for diff completion
    await waitForOutputChannelText(page, { expectedText: 'Diff completed for 1 file', timeout: 60_000 });
    await saveScreenshot(page, 'diff-palette.diff-completed.png');

    // Verify diff editor opens - look for editor groups (should be 2)
    const editorGroups = page.locator('#workbench\\.parts\\.editor .editor-group-container');
    await expect(editorGroups, 'Should have 2 editor groups for diff view').toHaveCount(2, { timeout: 10_000 });
    await saveScreenshot(page, 'diff-palette.diff-editor-opened.png');

    // Verify diff tab exists with expected title pattern: remote//FileName.cls ↔ local//FileName.cls
    const diffTabTitle = `remote//${className}.cls ↔ local//${className}.cls`;
    const diffTab = page.getByRole('tab', { name: new RegExp(diffTabTitle.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
    await expect(diffTab, `Diff tab with title "${diffTabTitle}" should exist`).toBeVisible({ timeout: 10_000 });
    await saveScreenshot(page, 'diff-palette.verified-diff-tab.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

(isMacDesktop() ? test.skip.bind(test) : test)(
  'Source Diff: diff via explorer context menu shows diff editor',
  async ({ page }) => {
    test.setTimeout(DEPLOY_TIMEOUT);
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    let className: string;
    let statusBarPage: SourceTrackingStatusBarPage;

    await test.step('setup minimal org and disable deploy-on-save', async () => {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await assertWelcomeTabExists(page);
      await closeWelcomeTabs(page);
      await saveScreenshot(page, 'explorer-setup.after-workbench.png');
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
      await saveScreenshot(page, 'explorer-setup.after-auth-fields.png');

      statusBarPage = new SourceTrackingStatusBarPage(page);
      await statusBarPage.waitForVisible(120_000);
      await saveScreenshot(page, 'explorer-setup.after-status-bar-visible.png');

      await upsertSettings(page, { [`${METADATA_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
      await saveScreenshot(page, 'explorer-setup.complete.png');
    });

    await test.step('create and deploy class', async () => {
      className = `SourceDiffExplorerTest${Date.now()}`;
      await createApexClass(page, className);
      await saveScreenshot(page, 'explorer-create-deploy.after-create-class.png');

      await statusBarPage.waitForCounts({ local: 1 }, 60_000);
      await saveScreenshot(page, 'explorer-create-deploy.after-local-count-1.png');

      await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);
      await saveScreenshot(page, 'explorer-create-deploy.after-deploy-command.png');

      const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
      await saveScreenshot(page, 'explorer-create-deploy.deploy-notification-appeared.png');
      await expect(deployingNotification).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });

      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
      await waitForOutputChannelText(page, { expectedText: 'deployed', timeout: DEPLOY_TIMEOUT });
      await saveScreenshot(page, 'explorer-create-deploy.deploy-complete.png');
    });

    await test.step('create local change and diff via explorer context menu', async () => {
      await executeCommandWithCommandPalette(page, 'View: Close All Editors');
      await saveScreenshot(page, 'diff-explorer.after-close-editors.png');

      await openFileByName(page, `${className}.cls`);
      await saveScreenshot(page, 'diff-explorer.after-open-file.png');

      const apexEditor = page.locator(`[data-uri*="${className}.cls"]`).first();
      await apexEditor.waitFor({ state: 'visible', timeout: 10_000 });
      await apexEditor.click();

      await editOpenFile(page, '// Explorer context menu diff test');
      await saveScreenshot(page, 'diff-explorer.after-edit.png');

      await statusBarPage.waitForCounts({ local: 1 }, 60_000);
      await saveScreenshot(page, 'diff-explorer.after-local-count-1.png');

      // Ensure file is saved before diffing
      await page.keyboard.press('Control+s');
      await page.locator(EDITOR).first().waitFor({ state: 'visible', timeout: 5000 });
      await saveScreenshot(page, 'diff-explorer.after-save.png');

      // Clear output and execute diff via explorer context menu
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
      await clearOutputChannel(page);

      // Right-click file in explorer - match .cls but not .cls-meta.xml
      await executeExplorerContextMenuCommand(
        page,
        new RegExp(`${className}\\.cls(?!-meta\\.xml)`),
        packageNls.diff_source_against_org_text
      );
      await saveScreenshot(page, 'diff-explorer.after-context-menu-command.png');

      // Wait for retrieving message
      await waitForOutputChannelText(page, { expectedText: 'Retrieving 1 component for diff...', timeout: 30_000 });
      await saveScreenshot(page, 'diff-explorer.retrieving-message.png');

      // Wait for retrieve output
      await waitForOutputChannelText(page, { expectedText: 'Retrieved Source', timeout: DEPLOY_TIMEOUT });
      await saveScreenshot(page, 'diff-explorer.after-retrieve.png');

      // Verify retrieve succeeded
      const hasNoComponents = await outputChannelContains(page, '0 components retrieved');
      expect(hasNoComponents, 'Should not show "0 components retrieved"').toBe(false);

      const hasNoResults = await outputChannelContains(page, 'No components retrieved from org');
      expect(hasNoResults, 'Should not show "No components retrieved from org"').toBe(false);

      const hasNoMatchingFiles = await outputChannelContains(page, 'No matching files found to diff');
      expect(hasNoMatchingFiles, 'Should not show "No matching files found to diff"').toBe(false);

      // Wait for diff completion
      await waitForOutputChannelText(page, { expectedText: 'Diff completed for 1 file', timeout: 60_000 });
      await saveScreenshot(page, 'diff-explorer.diff-completed.png');

      // Verify diff editor opens
      const editorGroups = page.locator('#workbench\\.parts\\.editor .editor-group-container');
      await expect(editorGroups, 'Should have 2 editor groups for diff view').toHaveCount(2, { timeout: 10_000 });
      await saveScreenshot(page, 'diff-explorer.diff-editor-opened.png');

      // Verify diff tab exists
      const diffTabTitle = `remote//${className}.cls ↔ local//${className}.cls`;
      const diffTab = page.getByRole('tab', {
        name: new RegExp(diffTabTitle.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      });
      await expect(diffTab, `Diff tab with title "${diffTabTitle}" should exist`).toBeVisible({ timeout: 10_000 });
      await saveScreenshot(page, 'diff-explorer.verified-diff-tab.png');
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
