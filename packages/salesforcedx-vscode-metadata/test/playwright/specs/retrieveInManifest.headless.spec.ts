/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test } from '../fixtures';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  assertWelcomeTabExists,
  closeWelcomeTabs,
  createDreamhouseOrg,
  upsertScratchOrgAuthFieldsToSettings,
  createFileWithContents,
  openFileByName,
  executeEditorContextMenuCommand,
  executeExplorerContextMenuCommand,
  executeCommandWithCommandPalette,
  isMacDesktop,
  validateNoCriticalErrors,
  saveScreenshot,
  ensureOutputPanelOpen,
  selectOutputChannel,
  waitForOutputChannelText,
  EDITOR
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import packageNls from '../../../package.nls.json';

const manifestContent = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>*</members>
    <name>ApexClass</name>
  </types>
  <version>65.0</version>
</Package>`;

// eslint-disable-next-line jest/unbound-method
(isMacDesktop() ? test.skip : test)('Retrieve In Manifest: retrieves via all entry points', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let statusBarPage: SourceTrackingStatusBarPage;

  await test.step('setup dreamhouse org', async () => {
    const createResult = await createDreamhouseOrg();
    await waitForVSCodeWorkbench(page);
    await saveScreenshot(page, 'setup.after-workbench.png');
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    await saveScreenshot(page, 'setup.after-auth-fields.png');

    statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);
    await saveScreenshot(page, 'setup.after-status-bar-visible.png');

    // Create the manifest file at project root
    await createFileWithContents(page, 'package.xml', manifestContent);
    await saveScreenshot(page, 'setup.after-create-manifest.png');

    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
    await saveScreenshot(page, 'setup.complete.png');
  });

  await test.step('1. Editor context menu', async () => {
    // Open the manifest file
    await openFileByName(page, 'package.xml');
    await saveScreenshot(page, 'step1.after-open-manifest.png');

    // Ensure the manifest editor is focused and ready
    const manifestEditor = page.locator(`${EDITOR}[data-uri*="package.xml"]`).first();
    await manifestEditor.waitFor({ state: 'visible', timeout: 10_000 });
    await manifestEditor.click();
    await saveScreenshot(page, 'step1.manifest-focused.png');

    // Prepare output channel before triggering command
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await saveScreenshot(page, 'step1.output-panel-ready.png');

    // Right-click the manifest editor → "SFDX: Retrieve Source in Manifest from Org"
    await executeEditorContextMenuCommand(page, packageNls.retrieve_in_manifest_text, 'package.xml');
    await saveScreenshot(page, 'step1.after-context-menu.png');

    // Verify retrieve starts and completes via output channel
    await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
    await saveScreenshot(page, 'step1.retrieve-started.png');

    await waitForOutputChannelText(page, { expectedText: 'retrieved', timeout: 240_000 });
    await saveScreenshot(page, 'step1.retrieve-complete.png');
  });

  await test.step('2. Explorer context menu (file)', async () => {
    // Close any open editors to ensure clean state
    await executeCommandWithCommandPalette(page, 'View: Close All Editors');
    await saveScreenshot(page, 'step2.after-close-editors.png');

    // Prepare output channel
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await saveScreenshot(page, 'step2.output-panel-ready.png');

    // Right-click manifest in explorer → "SFDX: Retrieve Source in Manifest from Org"
    await executeExplorerContextMenuCommand(page, /package\.xml/i, packageNls.retrieve_in_manifest_text);
    await saveScreenshot(page, 'step2.after-context-menu.png');

    // Verify retrieve starts and completes via output channel
    await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
    await saveScreenshot(page, 'step2.retrieve-started.png');

    await waitForOutputChannelText(page, { expectedText: 'retrieved', timeout: 240_000 });
    await saveScreenshot(page, 'step2.retrieve-complete.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
