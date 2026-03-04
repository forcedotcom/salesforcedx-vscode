/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';

import {
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  EDITOR_WITH_URI,
  NOTIFICATION_LIST_ITEM,
  QUICK_INPUT_LIST_ROW,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  TAB,
  validateNoCriticalErrors,
  verifyCommandExists
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
    await page.keyboard.type(scriptName);
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
    await expect(page.locator(TAB).filter({ hasText: /debug\.log/ })).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(EDITOR_WITH_URI).filter({ hasText: /hello|selection|USER_DEBUG/ })).toBeVisible({ timeout: 10_000 });
    await saveScreenshot(page, 'exec-document.success.png');
  });

  await test.step('select first line and execute selection', async () => {
    await page.keyboard.press('Escape');
    await page.locator(TAB).filter({ hasText: /\.apex$/ }).click({ force: true });
    const editor = page.locator(EDITOR_WITH_URI).first();
    await editor.click();

    // Select All via command palette (workbench click in openCommandPalette is fine here —
    // editor.action.selectAll targets the active editor regardless of transient focus)
    await executeCommandWithCommandPalette(page, 'Select All');

    // Open command palette directly with F1 — NOT executeCommandWithCommandPalette,
    // because openCommandPalette clicks the workbench which clears the editor selection
    await page.keyboard.press('F1');
    const widget = page.locator(QUICK_INPUT_WIDGET);
    await expect(widget).toBeVisible({ timeout: 5000 });
    const input = widget.locator('input.input');
    await input.fill(`>${packageNls['apexLog.command.executeSelection']}`);
    const commandRow = widget
      .locator(QUICK_INPUT_LIST_ROW)
      .filter({ hasText: new RegExp(`^${packageNls['apexLog.command.executeSelection'].replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })
      .first();
    await expect(commandRow).toBeAttached({ timeout: 5000 });
    await commandRow.evaluate(el => {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      (el as HTMLElement).click();
    });

    await expect(page.locator(TAB).filter({ hasText: /debug\.log/ })).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(EDITOR_WITH_URI).filter({ hasText: /hello|selection|USER_DEBUG/ })).toBeVisible({ timeout: 10_000 });
    await saveScreenshot(page, 'exec-selection.success.png');
  });

  await test.step('execute with compile error and verify error notification', async () => {
    await page.keyboard.press('Escape');
    const apexTab = page.locator(TAB).filter({ hasText: /\.apex$/ });
    await apexTab.click({ force: true });
    const editor = page.locator(EDITOR_WITH_URI).first();
    await editor.click();
    await executeCommandWithCommandPalette(page, 'Select All');
    await page.keyboard.press('Delete');
    await page.keyboard.type("Integer x = 'bad';");
    // Ensure apex tab/editor has focus before command palette (when clause requires editorLangId apex)
    await apexTab.click({ force: true });
    await page.getByText("Integer x = 'bad';", { exact: true }).waitFor({ state: 'visible', timeout: 5000 });
    await editor.click();
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.executeDocument']);
    const errorNotification = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /Line \d+.*Column \d+/ })
      .first();
    await expect(errorNotification).toBeVisible({ timeout: 15_000 });
    await saveScreenshot(page, 'compile-error.notification.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
