/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test } from '../fixtures';
import { expect, Page } from '@playwright/test';
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
  outputChannelContains
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { waitForDeployProgressNotificationToAppear } from '../pages/notifications';
import { METADATA_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../constants';

const verifyDiffCompleted = async (page: Page, className: string, screenshotPrefix: string) => {
  // Wait for retrieving message
  await waitForOutputChannelText(page, { expectedText: 'Retrieving 1 component for diff...', timeout: 30_000 });

  // Wait for retrieve output (optional, only for explorer)
  await waitForOutputChannelText(page, { expectedText: 'Retrieved Source', timeout: DEPLOY_TIMEOUT });

  // Verify retrieve succeeded
  expect(await outputChannelContains(page, '0 components retrieved'), 'Should not show "0 components retrieved"').toBe(
    false
  );

  expect(
    await outputChannelContains(page, 'No components retrieved from org'),
    'Should not show "No components retrieved from org"'
  ).toBe(false);

  expect(
    await outputChannelContains(page, 'No matching files found to diff'),
    'Should not show "No matching files found to diff"'
  ).toBe(false);

  // Wait for diff completion
  await waitForOutputChannelText(page, { expectedText: 'Diff completed for 1 file', timeout: 60_000 });

  // Verify diff editor opens
  await expect(
    page.locator('#workbench\\.parts\\.editor .editor-group-container'),
    'Should have 2 editor groups for diff view'
  ).toHaveCount(2, { timeout: 10_000 });
  await saveScreenshot(page, `${screenshotPrefix}.diff-editor-opened.png`);

  // Verify diff tab exists
  const diffTabTitle = `remote//${className}.cls ↔ local//${className}.cls`;
  const diffTab = page.getByRole('tab', {
    name: new RegExp(diffTabTitle.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  });
  await expect(diffTab, `Diff tab with title "${diffTabTitle}" should exist`).toBeVisible({ timeout: 10_000 });
};

test('Source Diff: diff shows diff editor', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const classNamePalette = `SourceDiffTest${Date.now()}`;
  let statusBarPage: SourceTrackingStatusBarPage;

  await test.step('setup minimal org and disable deploy-on-save', async () => {
    const createResult = await createMinimalOrg();
    await waitForVSCodeWorkbench(page);
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);

    statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);

    // Disable deploy-on-save so test can control when deploys happen
    await upsertSettings(page, { [`${METADATA_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });
  });

  await test.step('create and deploy class for command palette diff', async () => {
    await createApexClass(page, classNamePalette);

    await statusBarPage.waitForCounts({ local: 1 }, 60_000);

    await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);

    const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
    await expect(deployingNotification).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });

    // Wait for deploy completion via output channel
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await waitForOutputChannelText(page, { expectedText: 'deployed', timeout: DEPLOY_TIMEOUT });
  });

  await test.step('create local change and diff via command palette', async () => {
    await executeCommandWithCommandPalette(page, 'View: Close All Editors');

    await openFileByName(page, `${classNamePalette}.cls`);

    const apexEditor = page.locator(`[data-uri*="${classNamePalette}.cls"]`).first();
    await apexEditor.waitFor({ state: 'visible', timeout: 10_000 });
    await apexEditor.click();

    await editOpenFile(page, '// Local change for diff test');

    await statusBarPage.waitForCounts({ local: 1 }, 60_000);

    // Clear output and execute diff
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, packageNls.diff_source_against_org_text);

    await verifyDiffCompleted(page, classNamePalette, 'diff-palette');
  });

  await test.step('create local change and diff via explorer context menu', async step => {
    step.skip(isMacDesktop(), 'Explorer context menu not available on Mac Desktop');

    await executeCommandWithCommandPalette(page, 'View: Close All Editors');

    await openFileByName(page, `${classNamePalette}.cls`);

    const apexEditor = page.locator(`[data-uri*="${classNamePalette}.cls"]`).first();
    await apexEditor.waitFor({ state: 'visible', timeout: 10_000 });
    await apexEditor.click();

    await editOpenFile(page, '// Explorer context menu diff test');

    await statusBarPage.waitForCounts({ local: 1 }, 60_000);

    // Clear output and execute diff via explorer context menu
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);

    // Right-click file in explorer - match .cls but not .cls-meta.xml
    await executeExplorerContextMenuCommand(
      page,
      new RegExp(`${classNamePalette}\\.cls(?!-meta\\.xml)`),
      packageNls.diff_source_against_org_text
    );

    await verifyDiffCompleted(page, classNamePalette, 'diff-explorer');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
