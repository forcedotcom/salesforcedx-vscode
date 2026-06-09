/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type FrameLocator } from '@playwright/test';
import {
  EDITOR,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  hasContent,
  hasTitle,
  isDesktop,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForExtensionsActivated,
  waitForNotification,
  waitForQuickInputFirstOption,
  webviewActiveFrame
} from '@salesforce/playwright-vscode-ext';
import { test } from '../fixtures';
import packageNls from '../../../package.nls.json';
import { messages } from '../../../src/messages/i18n';

const SOQL_FILE = 'MySoqlSaveFile';
const SOQL_QUERY = 'SELECT Id, Name FROM Account LIMIT 5';

/**
 * Accept the save target after a save button is clicked. The webview posts `save_records`,
 * which the extension handles differently per workspace scheme (see queryDataFileService.save).
 * Desktop (`file` scheme) shows `showSaveDialog`, rendered as a simple quick-input dialog
 * (files.simpleDialog.enable=true) pre-filled with the default `<name>.<ext>` path.
 * Web (memfs scheme) shows `showInputBox` (file name, pre-filled with the default stem) followed by
 * `promptForOutputDir` (target-directory quick pick, default = scripts/soql).
 * Both paths end in the same `info_file_save_success` notification.
 */
const acceptSaveTarget = async (
  page: Parameters<typeof waitForNotification>[0],
  ext: 'csv' | 'json'
): Promise<void> => {
  const quickInput = page.locator(QUICK_INPUT_WIDGET);
  await quickInput.waitFor({ state: 'visible', timeout: 15_000 });

  if (isDesktop()) {
    // Simple save dialog: input pre-filled with the default <name>.<ext> path. Accept as-is.
    const input = quickInput.locator('input.input');
    await expect(input, `save dialog should default to a .${ext} file`).toHaveValue(new RegExp(`\\.${ext}$`), {
      timeout: 5000
    });
    await quickInput.getByRole('button', { name: 'OK' }).click();
    return;
  }

  // Web: accept the default file name, then accept the default output directory.
  await page.keyboard.press('Enter');
  await waitForQuickInputFirstOption(page, { quickInputVisibleTimeout: 10_000, optionVisibleTimeout: 10_000 });
  await page.keyboard.press('Enter');
  await quickInput.waitFor({ state: 'hidden', timeout: 10_000 });
};

/**
 * Open a just-saved export file from the Explorer tree. The extension calls `revealInExplorer`
 * after a successful save, so the file is already revealed. Quick Open is unreliable here: on web
 * the memfs file isn't indexed promptly, so it never appears in "Go to File…".
 */
const openSavedFile = async (page: Parameters<typeof waitForNotification>[0], fileName: string): Promise<void> => {
  const treeItem = page
    .locator('[role="treeitem"]')
    .filter({ hasText: new RegExp(`${fileName.replace('.', '\\.')}$`) })
    .first();
  await expect(treeItem, `${fileName} should be revealed in the Explorer`).toBeVisible({ timeout: 15_000 });
  await treeItem.dblclick();
  await expect(page.locator(`${EDITOR}[data-uri$="${fileName}"]`), `${fileName} should open in an editor`).toBeVisible({
    timeout: 15_000
  });
};

test('SOQL Builder: save query results to CSV and JSON', async ({ page }) => {
  test.setTimeout(180_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Both webviews stay open for the whole test; resolve each by its inner content rather than
  // DOM order (the outer iframe.webview has no deterministic attributes). The builder's
  // #active-frame hosts the #main app root; the results panel sets its #active-frame title.
  let soqlFrame: FrameLocator;
  let resultsFrame: FrameLocator;

  await test.step('setup workbench', async () => {
    await setupMinimalOrgAndAuth(page);
    await waitForExtensionsActivated(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'save.setup.complete.png');
  });

  await test.step('open SOQL Builder and build query', async () => {
    await executeCommandWithCommandPalette(page, packageNls.soql_open_new_builder);

    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
    await page.keyboard.type(SOQL_FILE);
    await page.keyboard.press('Enter');

    await waitForQuickInputFirstOption(page, { quickInputVisibleTimeout: 10_000, optionVisibleTimeout: 10_000 });
    await page.keyboard.press('Enter');

    const soqlTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
    await expect(soqlTab, `${SOQL_FILE}.soql tab should be visible`).toBeVisible({ timeout: 20_000 });

    soqlFrame = await webviewActiveFrame(page, hasContent('#main'));

    await soqlFrame.getByPlaceholder('Search object...').click();
    await soqlFrame.getByPlaceholder('Search object...').fill('Account');
    await soqlFrame.locator('p.option[data-option-value="Account"]').click();

    await soqlFrame.getByPlaceholder('Search fields...').first().click();
    await soqlFrame.locator('querybuilder-fields p.option[data-option-value="Id"]').click();
    await soqlFrame.getByPlaceholder('Search fields...').first().click();
    await soqlFrame.locator('querybuilder-fields p.option[data-option-value="Name"]').click();

    await soqlFrame.getByPlaceholder('Limit...').fill('5');
    await soqlFrame.getByPlaceholder('Limit...').press('Tab');

    await expect(
      soqlFrame.locator('.query-preview-container pre'),
      'query preview should show the built SOQL statement'
    ).toContainText(SOQL_QUERY);
    await saveScreenshot(page, 'save.query-built.png');

    await executeCommandWithCommandPalette(page, 'File: Save');
  });

  await test.step('run query from SOQL Builder', async () => {
    await soqlFrame.getByRole('button', { name: 'Run Query' }).click();

    const resultsTab = page.locator('[role="tab"]').filter({ hasText: messages.soql_query_results });
    await expect(resultsTab, 'SOQL Query Results tab should appear').toBeVisible({ timeout: 30_000 });
    await saveScreenshot(page, 'save.results-tab-visible.png');

    resultsFrame = await webviewActiveFrame(page, hasTitle(messages.soql_query_results));
  });

  await test.step('save results as CSV', async () => {
    const saveCsvButton = resultsFrame.getByRole('button', { name: 'Save as CSV' });
    await expect(saveCsvButton, 'Save as CSV button should be visible').toBeVisible({ timeout: 30_000 });
    await saveCsvButton.click();

    await acceptSaveTarget(page, 'csv');
    await waitForNotification(page, /We saved the results as:.*\.csv/, { timeout: 30_000 });
    await saveScreenshot(page, 'save.csv-notification.png');
    await executeCommandWithCommandPalette(page, 'Notifications: Clear All Notifications');
  });

  await test.step('verify CSV file contents', async () => {
    await openSavedFile(page, `${SOQL_FILE}.csv`);
    const editorText = page.locator(`${EDITOR}[data-uri$="${SOQL_FILE}.csv"] .view-lines`);
    await expect(editorText, 'CSV header should include the queried columns').toContainText('Id');
    await expect(editorText).toContainText('Name');
    await saveScreenshot(page, 'save.csv-verified.png');
  });

  await test.step('save results as JSON', async () => {
    const resultsTab = page.locator('[role="tab"]').filter({ hasText: messages.soql_query_results });
    await resultsTab.click();

    const saveJsonButton = resultsFrame.getByRole('button', { name: 'Save as JSON' });
    await expect(saveJsonButton, 'Save as JSON button should be visible').toBeVisible({ timeout: 15_000 });
    await saveJsonButton.click();

    await acceptSaveTarget(page, 'json');
    await waitForNotification(page, /We saved the results as:.*\.json/, { timeout: 30_000 });
    await saveScreenshot(page, 'save.json-notification.png');
    await executeCommandWithCommandPalette(page, 'Notifications: Clear All Notifications');
  });

  await test.step('verify JSON file contents', async () => {
    await openSavedFile(page, `${SOQL_FILE}.json`);
    const editorText = page.locator(`${EDITOR}[data-uri$="${SOQL_FILE}.json"] .view-lines`);
    await expect(editorText, 'JSON export should contain the queried fields').toContainText('Name');
    await saveScreenshot(page, 'save.json-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
