/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import {
  closeSettingsTab,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  QUICK_INPUT_LIST_ROW,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';

test.describe.configure({ mode: 'serial' });

/** Open find dialog via command palette, search for query, assert positive match count, close. */
const findInEditor = async (page: Page, query: string): Promise<void> => {
  const editor = page.locator(EDITOR_WITH_URI).first();
  await editor.click();
  await executeCommandWithCommandPalette(page, 'Find');
  const findInput = page.getByRole('textbox', { name: 'Find' });
  await expect(findInput).toBeVisible({ timeout: 10_000 });
  await findInput.fill(query);
  const findDialog = page.getByRole('dialog', { name: /Find/ });
  await expect(findDialog.getByText(/(\d+|\?) of \d+/).filter({ hasNotText: /No results/ })).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Escape');
};

/** Re-open trace flags doc and verify it contains `query` via the find dialog. */
const openTraceFlagsAndExpectContent = async (page: Page, query: string): Promise<void> => {
  await expect(async () => {
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsOpen']);
    await expect(page.locator('.tab').filter({ hasText: /traceFlags\.json/ })).toBeVisible({ timeout: 10_000 });
    await findInEditor(page, query);
  }).toPass({ timeout: 30_000 });
};

test('Trace flag for another user: SOSL picker, verify in virtual doc, cleanup', async ({ page }) => {
  test.setTimeout(240_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup minimal org auth', async () => {
    await setupMinimalOrgAndAuth(page);
    await closeSettingsTab(page);
    await ensureSecondarySideBarHidden(page);
  });

  await test.step('open trace flags', async () => {
    await verifyCommandExists(page, packageNls['apexLog.command.traceFlagsOpen'], 30_000);
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsOpen']);
    await expect(page.locator('.tab').filter({ hasText: /traceFlags\.json/ })).toBeVisible({ timeout: 30_000 });
    await saveScreenshot(page, 'trace-other-user.opened.png');
  });

  await test.step('create trace flag for Integration User via SOSL picker', async () => {
    await verifyCommandExists(page, packageNls['apexLog.command.traceFlagsCreateForUser'], 30_000);
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsCreateForUser']);

    const userPicker = page.locator(QUICK_INPUT_WIDGET);
    await userPicker.waitFor({ state: 'visible', timeout: 10_000 });
    const pickerInput = userPicker.locator('input.input');
    await pickerInput.click();
    await pickerInput.fill('Integration');
    const integrationUserRow = page.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: /Integration User/i }).first();
    await expect(integrationUserRow).toBeVisible({ timeout: 45_000 });
    await integrationUserRow.evaluate(el => {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      (el as HTMLElement).click();
    });
    await saveScreenshot(page, 'trace-other-user.user-selected.png');

    const debugLevelPicker = page.locator(QUICK_INPUT_WIDGET);
    await debugLevelPicker.waitFor({ state: 'visible', timeout: 10_000 });
    const debugLevelRow = page
      .locator(QUICK_INPUT_LIST_ROW)
      .filter({ hasText: /SFDC_DevConsole|Developer Console|Apex=/i })
      .first();
    await expect(debugLevelRow).toBeVisible({ timeout: 15_000 });
    await debugLevelRow.evaluate(el => {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      (el as HTMLElement).click();
    });
    await saveScreenshot(page, 'trace-other-user.debug-level-selected.png');
  });

  await test.step('verify trace flag appears in virtual doc under USER_DEBUG for Integration User', async () => {
    await openTraceFlagsAndExpectContent(page, 'Integration User');
    await saveScreenshot(page, 'trace-other-user.verified.png');
  });

  await test.step('cleanup: delete trace flag via Remove code lens', async () => {
    const traceFlagsTab = page.locator('.tab').filter({ hasText: /traceFlags\.json/ });
    await traceFlagsTab.click({ force: true });
    const editor = page.locator(EDITOR_WITH_URI).first();
    await editor.click();
    await findInEditor(page, 'Integration User');
    const removeLens = page.locator('.codelens-decoration a').filter({ hasText: /^Remove$/ });
    await expect(removeLens.first()).toBeVisible({ timeout: 15_000 });
    await removeLens.first().click();
    await openTraceFlagsAndExpectContent(page, '"USER_DEBUG"');
    await saveScreenshot(page, 'trace-other-user.cleanup.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
