/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';

import {
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  expectProblemsCountAtLeast,
  EDITOR_WITH_URI,
  NOTIFICATION_LIST_ITEM,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  TAB,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForQuickInputFirstOption,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';

test('Execute Anonymous Apex: document, selection, script creation, compile error', async ({ page }) => {
  test.setTimeout(180_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const scriptName = `AnonTest${Date.now()}`;

  await test.step('setup minimal org auth', async () => {
    await setupMinimalOrgAndAuth(page);
    await ensureSecondarySideBarHidden(page);
  });

  await test.step('create anonymous apex script via command palette', async () => {
    await verifyCommandExists(page, packageNls['apexLog.command.createAnonymousApexScript'], 30_000);
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.createAnonymousApexScript']);
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await quickInput.getByText(/Enter script name/i).waitFor({ state: 'visible', timeout: 5000 });
    const quickInputText = quickInput.locator('input.input').first();
    await quickInputText.waitFor({ state: 'visible', timeout: 5000 });
    await quickInputText.fill(scriptName);
    await page.keyboard.press('Enter');
    await waitForQuickInputFirstOption(page);
    await page.keyboard.press('Enter');
    const editor = page.locator(EDITOR_WITH_URI).first();
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(page.locator(TAB).filter({ hasText: /\.apex$/ })).toBeVisible({ timeout: 5000 });
    await saveScreenshot(page, 'create-script.apex-opened.png');
  });

  await test.step('type simple Apex and execute document', async () => {
    const editor = page.locator(EDITOR_WITH_URI).first();
    await editor.click();
    await editor.locator('.view-line').first().waitFor({ state: 'visible', timeout: 5000 });
    await executeCommandWithCommandPalette(page, 'Select All');
    await page.keyboard.press('Delete');
    await page.keyboard.type("System.debug('hello');\nSystem.debug('selection');");
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.executeDocument']);
    const successNotification = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /executed successfully/i })
      .first();
    await expect(successNotification).toBeVisible({ timeout: 60_000 });
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Apex Log');
    await waitForOutputChannelText(page, { expectedText: 'Execute anonymous succeeded', timeout: 10_000 });
    await waitForOutputChannelText(page, { expectedText: 'USER_DEBUG', timeout: 5000 });
    await successNotification.getByRole('button', { name: /Open Log/i }).click();
    const logTab = page.locator(TAB).filter({ hasText: /debug\.log/ });
    await expect(logTab).toBeVisible({ timeout: 10_000 });
    await saveScreenshot(page, 'exec-document.success.png');
    // Close debug.log so the .apex file is active for the next step (execute anonymous requires editorLangId apex)
    await executeCommandWithCommandPalette(page, 'View: Close Editor');
    await expect(logTab).not.toBeVisible({ timeout: 5000 });
  });

  await test.step('select first line and execute selection', async () => {
    const editor = page.locator(EDITOR_WITH_URI).first();
    await editor.click();
    await executeCommandWithCommandPalette(page, 'Select All');
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.executeSelection']);

    const successNotification = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /executed successfully/i })
      .first();
    await expect(successNotification).toBeVisible({ timeout: 60_000 });
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Apex Log');
    await waitForOutputChannelText(page, { expectedText: 'Execute anonymous succeeded', timeout: 10_000 });
    await waitForOutputChannelText(page, { expectedText: 'execute_anonymous_apex', timeout: 5000 });
    await successNotification.getByRole('button', { name: /Open Log/i }).click();
    const logTab = page.locator(TAB).filter({ hasText: /debug\.log/ });
    await expect(logTab).toBeVisible({ timeout: 10_000 });
    await saveScreenshot(page, 'exec-selection.success.png');
    // Close debug.log so the .apex file is active for the next step
    await executeCommandWithCommandPalette(page, 'View: Close Editor');
    await expect(logTab).not.toBeVisible({ timeout: 5000 });
  });

  await test.step('execute with compile error and verify error notification', async () => {
    const editor = page.locator(EDITOR_WITH_URI).first();
    await editor.click();
    await executeCommandWithCommandPalette(page, 'Select All');
    await page.keyboard.press('Delete');
    await page.keyboard.type("Integer x = 'bad';");
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.executeDocument']);
    const errorNotification = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /Line \d+.*Column \d+/ })
      .first();
    await expect(errorNotification).toBeVisible({ timeout: 15_000 });
    await saveScreenshot(page, 'compile-error.notification.png');
  });

  await test.step('fix code, re-execute, verify diagnostics cleared', async () => {
    await expectProblemsCountAtLeast(page, 1, { timeout: 15_000 });
    const editor = page.locator(EDITOR_WITH_URI).first();
    await editor.click();
    await executeCommandWithCommandPalette(page, 'Select All');
    await page.keyboard.press('Delete');
    await page.keyboard.type("System.debug('fixed');");
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.executeDocument']);
    const successNotification = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /executed successfully/i })
      .first();
    await expect(successNotification).toBeVisible({ timeout: 60_000 });
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Apex Log');
    await waitForOutputChannelText(page, { expectedText: 'Execute anonymous succeeded', timeout: 10_000 });
    await waitForOutputChannelText(page, { expectedText: 'fixed', timeout: 5000 });
    await saveScreenshot(page, 'fix-re-execute.success.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
