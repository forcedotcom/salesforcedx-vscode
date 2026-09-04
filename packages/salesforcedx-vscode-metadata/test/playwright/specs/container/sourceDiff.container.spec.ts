/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for diff-source-against-org. The web twin (sourceDiff.headless.spec.ts)
 * proves the diff command runs against a plain Page across its entry points; this proves a diff actually
 * retrieves from the org inside the Code Builder image, using the container's boot-authed org.
 *
 * Creates a uniquely-named throwaway class, deploys it, edits it locally, then diffs it against the org
 * via command palette and explorer context menu, so the shared mounted fixture is untouched. Completion
 * is asserted from the "Diff completed for 1 file" output line and the diff editor tab — the full
 * retrieve/CLI path (extension -> sf -> org) web mode cannot cover.
 */

import {
  clearAllNotifications,
  clearOutputChannel,
  closeAllEditors,
  closeWelcomeTabs,
  createApexClass,
  editOpenFile,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  executeExplorerContextMenuCommand,
  openFileByName,
  outputChannelContains,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { expect, type Page } from '@playwright/test';
import { waitForDeployProgressNotificationToAppear } from '../../pages/notifications';
import packageNls from '../../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../../constants';
import { containerTest as test } from '../../fixtures/containerFixtures';

const verifyDiffCompleted = async (page: Page, className: string, screenshotPrefix: string) => {
  await waitForOutputChannelText(page, { expectedText: 'Retrieving 1 component for diff...', timeout: 30_000 });

  expect(
    await outputChannelContains(page, '0 components retrieved', { timeout: 100 }),
    'Should not show "0 components retrieved"'
  ).toBe(false);
  expect(
    await outputChannelContains(page, 'No components retrieved from org', { timeout: 100 }),
    'Should not show "No components retrieved from org"'
  ).toBe(false);
  expect(
    await outputChannelContains(page, 'No matching files found to diff', { timeout: 100 }),
    'Should not show "No matching files found to diff"'
  ).toBe(false);

  await waitForOutputChannelText(page, { expectedText: 'Diff completed for 1 file', timeout: 60_000 });
  await saveScreenshot(page, `${screenshotPrefix}.diff-editor-opened.png`);

  const diffTabTitle = `remote//${className}.cls ↔ local//${className}.cls`;
  const diffTab = page.getByRole('tab', {
    name: new RegExp(diffTabTitle.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  });
  await expect(diffTab, `Diff tab with title "${diffTabTitle}" should exist`).toBeVisible({ timeout: 10_000 });
};

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('Source Diff (Code Builder): diff shows diff editor via palette and explorer', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const className = `SourceDiffTest${Date.now()}`;

  await test.step('workbench ready', async () => {
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'sourceDiff.container.01-ready.png');
  });

  await test.step('create and deploy a throwaway class', async () => {
    await createApexClass(page, className);

    await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);
    const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
    await expect(deployingNotification).not.toBeVisible({ timeout: DEPLOY_TIMEOUT });

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: DEPLOY_TIMEOUT });
    await saveScreenshot(page, 'sourceDiff.container.02-deployed.png');
  });

  await test.step('create local change and diff via command palette', async () => {
    await closeAllEditors(page);
    await openFileByName(page, `${className}.cls`);
    const apexEditor = page.locator(`[data-uri*="${className}.cls"]`).first();
    await apexEditor.waitFor({ state: 'visible', timeout: 10_000 });
    await apexEditor.click();
    await editOpenFile(page, '// Local change for diff test');

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, packageNls.diff_source_against_org_text);
    await verifyDiffCompleted(page, className, 'sourceDiff.container.diff-palette');
  });

  await test.step('create local change and diff via explorer context menu', async () => {
    await closeAllEditors(page);
    await openFileByName(page, `${className}.cls`);
    const apexEditor = page.locator(`[data-uri*="${className}.cls"]`).first();
    await apexEditor.waitFor({ state: 'visible', timeout: 10_000 });
    await apexEditor.click();
    await editOpenFile(page, '// Explorer context menu diff test');

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);

    // Right-click file in explorer - match .cls but not .cls-meta.xml
    await executeExplorerContextMenuCommand(
      page,
      new RegExp(`${className}\\.cls(?!-meta\\.xml)`),
      packageNls.diff_source_against_org_text
    );
    await verifyDiffCompleted(page, className, 'sourceDiff.container.diff-explorer');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
