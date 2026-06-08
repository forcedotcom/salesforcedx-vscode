/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { expect } from '@playwright/test';
import {
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForExtensionsActivated,
  waitForNotification,
  waitForQuickInputFirstOption
} from '@salesforce/playwright-vscode-ext';
import { desktopTest } from '../fixtures/desktopFixtures';
import packageNls from '../../../package.nls.json';

desktopTest('SOQL Run Query: save query results to CSV and JSON', async ({ page, workspaceDir }) => {
  desktopTest.setTimeout(180_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const SOQL_SAVE_FILE = 'MySoqlSaveFile';
  const SOQL_SAVE_QUERY = 'SELECT Id, Name FROM Account LIMIT 5';

  // frameLocator is synchronous/lazy — safe to declare before DOM exists.
  // In VS Code desktop-electron, webview iframes are NOT nested inside
  // .editor-group-container; they live in a separate overlay host. Using
  // page.frameLocator resolves across all matching iframes at action time,
  // finding the one whose content contains the target element.
  const soqlFrame = page.frameLocator('iframe.webview.ready').frameLocator('#active-frame');
  const resultsFrame = page.frameLocator('iframe.webview.ready').frameLocator('#active-frame');

  await desktopTest.step('setup workbench', async () => {
    await setupMinimalOrgAndAuth(page);
    await waitForExtensionsActivated(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'save.setup.complete.png');
  });

  await desktopTest.step('open SOQL Builder and build query', async () => {
    await executeCommandWithCommandPalette(page, packageNls.soql_open_new_builder);
    await saveScreenshot(page, 'save.step1.after-command.png');

    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
    await page.keyboard.type(SOQL_SAVE_FILE);
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'save.step1.file-name-entered.png');

    await waitForQuickInputFirstOption(page, { quickInputVisibleTimeout: 10_000, optionVisibleTimeout: 10_000 });
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'save.step1.dir-selected.png');

    const soqlTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_SAVE_FILE}.soql` });
    await expect(soqlTab, `${SOQL_SAVE_FILE}.soql tab should be visible`).toBeVisible({ timeout: 20_000 });

    // Build query: select Account, fields Id and Name, limit 5
    await soqlFrame.getByPlaceholder('Search object...').click();
    await soqlFrame.getByPlaceholder('Search object...').fill('Account');
    await soqlFrame.locator('p.option[data-option-value="Account"]').click();
    await saveScreenshot(page, 'save.step1.account-selected.png');

    await soqlFrame.getByPlaceholder('Search fields...').first().click();
    await soqlFrame.locator('querybuilder-fields p.option[data-option-value="Id"]').click();
    await soqlFrame.getByPlaceholder('Search fields...').first().click();
    await soqlFrame.locator('querybuilder-fields p.option[data-option-value="Name"]').click();

    await soqlFrame.getByPlaceholder('Limit...').fill('5');
    await soqlFrame.getByPlaceholder('Search object...').click();
    await saveScreenshot(page, 'save.step1.query-built.png');

    // Verify query preview
    await expect(
      soqlFrame.locator('.query-preview-container pre'),
      'query preview should show the built SOQL statement'
    ).toContainText(SOQL_SAVE_QUERY);

    await executeCommandWithCommandPalette(page, 'File: Save');
  });

  await desktopTest.step('run query from SOQL Builder and wait for results', async () => {
    await soqlFrame.getByRole('button', { name: 'Run Query' }).click();
    await saveScreenshot(page, 'save.step2.run-query-clicked.png');

    const resultsTab = page.locator('[role="tab"]').filter({ hasText: 'SOQL Query Results' });
    await expect(resultsTab, 'SOQL Query Results tab should appear').toBeVisible({ timeout: 30_000 });
    await saveScreenshot(page, 'save.step2.results-tab-visible.png');
  });

  await desktopTest.step('save results as CSV', async () => {
    // Click the results tab to ensure it is active/focused
    const resultsTab = page.locator('[role="tab"]').filter({ hasText: 'SOQL Query Results' });
    await resultsTab.click();

    // Wait for save-csv-button to be visible (webview content loaded)
    const saveCsvButton = resultsFrame.getByRole('button', { name: 'Save as CSV' });
    await expect(saveCsvButton, 'Save CSV button should be visible').toBeVisible({ timeout: 30_000 });
    await saveScreenshot(page, 'save.step3.csv-button-visible.png');

    await saveCsvButton.click();
    await saveScreenshot(page, 'save.step3.csv-button-clicked.png');

    // showSaveDialog with files.simpleDialog.enable=true renders a quick-input widget
    // with the default file path pre-filled. Accept the default path by pressing Enter.
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'save.step3.save-dialog-visible.png');

    // Verify the input contains a .csv filename
    const input = quickInput.locator('input.input');
    await expect(input).toHaveValue(/\.csv$/, { timeout: 5000 });

    // Click the OK button (VS Code simple save dialog action button — labeled "OK" when no saveLabel is set)
    const saveButton = quickInput.getByRole('button', { name: 'OK' });
    await saveButton.click();
    await saveScreenshot(page, 'save.step3.save-confirmed.png');

    // Assert success notification
    const csvNotification = await waitForNotification(page, /We saved the results as:.*\.csv/, { timeout: 30_000 });
    await saveScreenshot(page, 'save.step3.csv-notification.png');

    // Dismiss notification
    const closeButton = csvNotification.locator('.codicon-notifications-clear');
    await expect(closeButton).toBeVisible({ timeout: 5000 });
    await closeButton.click();

    // Assert CSV file exists on disk
    await expect(async () => {
      const files = await fs.readdir(workspaceDir, { recursive: true });
      const csvFiles = files.filter(f => typeof f === 'string' && f.endsWith(`${SOQL_SAVE_FILE}.csv`));
      expect(csvFiles.length, 'CSV export file should exist in workspace').toBeGreaterThan(0);
      const csvPath = path.join(workspaceDir, csvFiles[0]);
      const content = await fs.readFile(csvPath, 'utf8');
      expect(content.length, 'CSV file should have non-empty content').toBeGreaterThan(0);
    }).toPass({ timeout: 30_000 });
    await saveScreenshot(page, 'save.step3.csv-file-verified.png');
  });

  await desktopTest.step('save results as JSON', async () => {
    // Click the results tab to re-focus
    const resultsTab = page.locator('[role="tab"]').filter({ hasText: 'SOQL Query Results' });
    await resultsTab.click();

    const saveJsonButton = resultsFrame.getByRole('button', { name: 'Save as JSON' });
    await expect(saveJsonButton, 'Save JSON button should be visible').toBeVisible({ timeout: 15_000 });
    await saveJsonButton.click();
    await saveScreenshot(page, 'save.step4.json-button-clicked.png');

    // Handle save dialog for JSON
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'save.step4.json-save-dialog.png');

    // Verify the input contains a .json filename
    const input = quickInput.locator('input.input');
    await expect(input).toHaveValue(/\.json$/, { timeout: 5000 });

    // Click the OK button (VS Code simple save dialog action button — labeled "OK" when no saveLabel is set)
    const saveButton = quickInput.getByRole('button', { name: 'OK' });
    await saveButton.click();
    await saveScreenshot(page, 'save.step4.json-save-confirmed.png');

    // Assert success notification
    await waitForNotification(page, /We saved the results as:.*\.json/, { timeout: 30_000 });
    await saveScreenshot(page, 'save.step4.json-notification.png');

    // Assert JSON file exists on disk and is valid JSON with records
    await expect(async () => {
      const files = await fs.readdir(workspaceDir, { recursive: true });
      const jsonFiles = files.filter(f => typeof f === 'string' && f.endsWith(`${SOQL_SAVE_FILE}.json`));
      expect(jsonFiles.length, 'JSON export file should exist in workspace').toBeGreaterThan(0);
      const jsonPath = path.join(workspaceDir, jsonFiles[0]);
      const content = await fs.readFile(jsonPath, 'utf8');
      const parsed = JSON.parse(content) as unknown;
      expect(Array.isArray(parsed) || (typeof parsed === 'object' && parsed !== null), 'JSON should be valid').toBe(
        true
      );
    }).toPass({ timeout: 30_000 });
    await saveScreenshot(page, 'save.step4.json-file-verified.png');
  });

  await validateNoCriticalErrors(desktopTest, consoleErrors, networkErrors);
});
