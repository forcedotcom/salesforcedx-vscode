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
  createDreamhouseOrg,
  upsertScratchOrgAuthFieldsToSettings,
  executeCommandWithCommandPalette,
  validateNoCriticalErrors,
  saveScreenshot,
  QUICK_INPUT_WIDGET,
  QUICK_INPUT_LIST_ROW,
  EDITOR_WITH_URI
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import packageNls from '../../../package.nls.json';

test('Apex Generate Class: creates new Apex class via command palette', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let className: string;
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

    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
    await saveScreenshot(page, 'setup.complete.png');
  });

  await test.step('create apex class via command palette', async () => {
    // Generate unique class name to avoid conflicts
    className = `GenerateClassTest${Date.now()}`;

    // Execute command
    await executeCommandWithCommandPalette(page, packageNls.apex_generate_class_text);
    await saveScreenshot(page, 'step1.after-command.png');

    // First prompt: "Enter Apex class name"
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await quickInput.getByText(/Enter Apex class name/i).waitFor({ state: 'visible', timeout: 10_000 });
    await saveScreenshot(page, 'step1.name-prompt-visible.png');

    // Type class name
    await page.keyboard.type(className);
    await saveScreenshot(page, 'step1.after-type-name.png');
    await page.keyboard.press('Enter');

    // Second prompt: Quick Pick to select output directory
    await page.locator(QUICK_INPUT_LIST_ROW).first().waitFor({ state: 'visible', timeout: 5000 });
    await saveScreenshot(page, 'step1.directory-prompt-visible.png');

    // Accept default directory
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step1.after-accept-directory.png');

    // Wait for the editor to open with the new class
    await page.locator(EDITOR_WITH_URI).first().waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'step1.editor-opened.png');
  });

  await test.step('verify file was created correctly', async () => {
    // Verify the editor tab shows the class name
    const editorTab = page.locator('[role="tab"]').filter({ hasText: new RegExp(`${className}\\.cls`, 'i') });
    await expect(editorTab).toBeVisible();
    await saveScreenshot(page, 'step2.tab-visible.png');

    // Verify the file appears in the explorer
    const explorerFile = page.locator('[role="treeitem"]').filter({ hasText: new RegExp(`${className}\\.cls$`, 'i') });
    await expect(explorerFile).toBeVisible();
    await saveScreenshot(page, 'step2.file-in-explorer.png');

    // Verify the editor contains the expected class structure
    const editorContent = page.locator('[data-uri*=".cls"]').first();
    await expect(editorContent).toBeVisible();

    // Check that the class name is in the editor
    // Use first() to handle desktop mode which has multiple .view-lines elements
    const editorText = page.locator('.view-lines').first();
    await expect(editorText).toContainText(`public class ${className}`);
    await saveScreenshot(page, 'step2.class-content-verified.png');

    // Get current counts for informational purposes (don't assert on exact values)
    const counts = await statusBarPage.getCounts();
    await saveScreenshot(page, `step2.counts-local-${counts.local}-remote-${counts.remote}.png`);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
