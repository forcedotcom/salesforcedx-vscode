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
  createApexClass,
  executeEditorContextMenuCommand,
  executeExplorerContextMenuCommand,
  executeCommandWithCommandPalette,
  isMacDesktop,
  validateNoCriticalErrors,
  saveScreenshot,
  EDITOR,
  QUICK_INPUT_WIDGET
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import packageNls from '../../../package.nls.json';
import { messages } from '../../../src/messages/i18n';

(isMacDesktop() ? test.skip.bind(test) : test)('Generate Manifest: generates via context menu entry points', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let className: string;
  let statusBarPage: SourceTrackingStatusBarPage;

  await test.step('setup minimal org', async () => {
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
  });

  await test.step('1. Editor context menu', async () => {
    // Create apex class (opens editor automatically)
    className = `GenerateManifestTest${Date.now()}`;
    await createApexClass(page, className);
    await saveScreenshot(page, 'step1.after-create-class.png');

    // Right-click in the editor → "SFDX: Generate Manifest File"
    await executeEditorContextMenuCommand(page, packageNls.project_generate_manifest_text, `${className}.cls`);
    await saveScreenshot(page, 'step1.after-context-menu.png');

    // Wait for input prompt
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'visible', timeout: 10_000 });
    await saveScreenshot(page, 'step1.manifest-prompt-visible.png');

    // Accept default filename (package.xml) by pressing Enter
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step1.after-accept-filename.png');

    // Wait for manifest file to be created and opened
    const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/package.xml"]`).first();
    await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'step1.manifest-opened.png');

    // Assert manifest file exists in explorer - focus explorer first, then look for file
    await executeCommandWithCommandPalette(page, 'File: Focus on Files Explorer');
    const manifestFile = page.getByRole('treeitem', { name: /package\.xml/i });
    await expect(manifestFile).toBeVisible({ timeout: 10_000 });
    await saveScreenshot(page, 'step1.manifest-in-explorer.png');

    // Close editors to prepare for next step
    await executeCommandWithCommandPalette(page, 'View: Close All Editors');
    await saveScreenshot(page, 'step1.after-close-editors.png');
  });

  await test.step('2. Explorer context menu (folder)', async () => {
    // Right-click classes folder in explorer → "SFDX: Generate Manifest File"
    await executeExplorerContextMenuCommand(page, /classes/i, packageNls.project_generate_manifest_text);
    await saveScreenshot(page, 'step2.after-context-menu.png');

    // Wait for input prompt
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'visible', timeout: 10_000 });
    await saveScreenshot(page, 'step2.manifest-prompt-visible.png');

    // Type a different filename to avoid overwrite prompt
    await page.keyboard.type('package2');
    await saveScreenshot(page, 'step2.after-type-filename.png');
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step2.after-accept-filename.png');

    // Wait for manifest file to be created and opened
    const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/package2.xml"]`).first();
    await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'step2.manifest-opened.png');

    // Assert manifest file exists in explorer - focus explorer first, then look for file
    await executeCommandWithCommandPalette(page, 'File: Focus on Files Explorer');
    const manifestFile = page.getByRole('treeitem', { name: /package2\.xml/i });
    await expect(manifestFile).toBeVisible({ timeout: 10_000 });
    await saveScreenshot(page, 'step2.manifest-in-explorer.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
