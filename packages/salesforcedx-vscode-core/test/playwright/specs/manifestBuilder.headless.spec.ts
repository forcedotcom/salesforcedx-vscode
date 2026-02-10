/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test } from '../fixtures';
import {
  setupConsoleMonitoring,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createMinimalOrg,
  upsertScratchOrgAuthFieldsToSettings,
  upsertSettings,
  openFileByName,
  executeCommandWithCommandPalette,
  executeExplorerContextMenuCommand,
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  isMacDesktop,
  validateNoCriticalErrors,
  saveScreenshot,
  EDITOR,
  QUICK_INPUT_WIDGET,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import { COMMAND_TIMEOUT, OUTPUT_CHANNEL } from '../constants';
import { createApexClassCore } from '../coreHelpers';

(isMacDesktop() ? test.skip.bind(test) : test)(
  'Manifest Builder: generate manifest, deploy and retrieve via manifest',
  async ({ page }) => {
    test.setTimeout(COMMAND_TIMEOUT);
    const consoleErrors = setupConsoleMonitoring(page);

    await test.step('setup: workbench, settings, create apex class', async () => {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await closeWelcomeTabs(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
      await verifyCommandExists(page, 'SFDX: Create Apex Class', 120_000);

      await upsertSettings(page, { 'salesforcedx-vscode-core.useMetadataExtensionCommands': 'false' });

      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, OUTPUT_CHANNEL, 120_000);

      // Create an apex class to include in the manifest
      await createApexClassCore(page, `ManifestTest${Date.now()}`);
      await saveScreenshot(page, 'setup.class-created.png');
    });

    await test.step('generate manifest file', async () => {
      // Command is only available via explorer context menu, not command palette
      // (Test is skipped on Mac Desktop where context menus don't work)
      await executeExplorerContextMenuCommand(page, /classes/i, 'SFDX: Generate Manifest File');

      // Wait for filename prompt and accept default
      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
      await saveScreenshot(page, 'manifest.prompt-visible.png');
      await page.keyboard.press('Enter');

      // Wait for manifest file to open in editor
      const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/package.xml"]`).first();
      await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
      await saveScreenshot(page, 'manifest.file-opened.png');
    });

    await test.step('deploy source in manifest', async () => {
      // Ensure manifest file is the active editor
      await openFileByName(page, 'package.xml');
      await clearOutputChannel(page);

      await executeCommandWithCommandPalette(page, 'SFDX: Deploy Source in Manifest to Org');
      await waitForOutputChannelText(page, {
        expectedText: 'Ended SFDX: Deploy Source in Manifest to Org',
        timeout: COMMAND_TIMEOUT
      });
      await saveScreenshot(page, 'manifest-deploy.complete.png');
    });

    await test.step('retrieve source in manifest', async () => {
      await openFileByName(page, 'package.xml');
      await clearOutputChannel(page);

      await executeCommandWithCommandPalette(page, 'SFDX: Retrieve Source in Manifest from Org');
      await waitForOutputChannelText(page, {
        expectedText: 'Ended SFDX: Retrieve Source in Manifest from Org',
        timeout: COMMAND_TIMEOUT
      });
      await saveScreenshot(page, 'manifest-retrieve.complete.png');
    });

    await validateNoCriticalErrors(test, consoleErrors);
  }
);
