/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import {
  APEX_TRACE_FLAG_STATUS_BAR,
  closeSettingsTab,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  selectFirstQuickInputOption,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';
import { waitForTraceFlagStatusBar } from '../helpers';

/** Open find dialog via command palette, search for query, assert positive match count, close. */
const findInEditor = async (page: Page, query: string): Promise<void> => {
  const editor = page.locator(EDITOR_WITH_URI).first();
  await editor.click();
  await executeCommandWithCommandPalette(page, 'Find');
  const findInput = page.getByRole('textbox', { name: 'Find' });
  await expect(findInput).toBeVisible({ timeout: 10_000 });
  await findInput.fill(query);
  const findDialog = page.getByRole('dialog', { name: /Find/ });
  await expect(findDialog.getByText(/(\d+|\?) of \d+/).filter({ hasNotText: /No results/ })).toBeVisible({
    timeout: 10_000
  });
  await page.keyboard.press('Escape');
};

/** Re-open trace flags doc and verify it contains `query` via the find dialog, retrying until the content provider refreshes. */
const openTraceFlagsAndExpectContent = async (page: Page, query: string): Promise<void> => {
  await expect(async () => {
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsOpen']);
    await expect(page.locator('.tab').filter({ hasText: /traceFlags\.json/ })).toBeVisible({ timeout: 10_000 });
    await findInEditor(page, query);
  }).toPass({ timeout: 30_000 });
};

test('Trace Flags CRUD: open, create/delete current user trace flag, create/delete debug level', async ({ page }) => {
  test.setTimeout(240_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const debugLevelMasterLabel = `TraceCrud${Date.now()}`;
  const debugLevelDeveloperName = debugLevelMasterLabel.slice(0, 40);

  await test.step('setup minimal org auth', async () => {
    await setupMinimalOrgAndAuth(page);
    await closeSettingsTab(page);
    await ensureSecondarySideBarHidden(page);
  });

  await test.step('cleanup stale trace flags from prior runs', async () => {
    await verifyCommandExists(page, packageNls['apexLog.command.traceFlagsOpen'], 30_000);
    const removeLink = page
      .locator('.codelens-decoration a')
      .filter({ hasText: /^Remove$/ })
      .first();
    await expect(async () => {
      await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsOpen']);
      await expect(page.locator('.tab').filter({ hasText: /traceFlags\.json/ })).toBeVisible({ timeout: 10_000 });
      if (await removeLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await removeLink.click();
      }
      await expect(removeLink).not.toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 60_000 });
  });

  await test.step('open trace flags and verify virtual document JSON content', async () => {
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsOpen']);
    await expect(page.locator('.tab').filter({ hasText: /traceFlags\.json/ })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('"traceFlags": {').first()).toBeVisible({ timeout: 30_000 });
    await saveScreenshot(page, 'trace-flags.opened.png');
  });

  await test.step('create trace flag for current user and verify status bar + code lens', async () => {
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsCreateForCurrentUser']);
    await expect(page.locator(APEX_TRACE_FLAG_STATUS_BAR).filter({ hasText: /Tracing until/ })).toBeVisible({
      timeout: 60_000
    });

    await openTraceFlagsAndExpectContent(page, '"DEVELOPER_LOG"');
    await expect(
      page
        .locator('.codelens-decoration a')
        .filter({ hasText: /^Remove$/ })
        .first()
    ).toBeVisible({
      timeout: 30_000
    });
    await saveScreenshot(page, 'trace-flag.created.png');
  });

  await test.step('create debug level and verify it appears in virtual document', async () => {
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsCreateLogLevel']);

    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await page.keyboard.type(debugLevelMasterLabel);
    await page.keyboard.press('Enter');

    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await page.keyboard.press('Control+a');
    await page.keyboard.type(debugLevelDeveloperName);
    await page.keyboard.press('Enter');

    await selectFirstQuickInputOption(page, { optionVisibleTimeout: 10_000 });

    await openTraceFlagsAndExpectContent(page, debugLevelMasterLabel);
    await saveScreenshot(page, 'debug-level.created.png');
  });

  await test.step('cleanup: delete current-user trace flag', async () => {
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsDeleteForCurrentUser']);
    await waitForTraceFlagStatusBar(page, /No Tracing/);
    await saveScreenshot(page, 'trace-flags.cleanup.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
