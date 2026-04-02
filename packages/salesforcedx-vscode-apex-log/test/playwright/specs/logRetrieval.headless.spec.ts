/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';

import {
  APEX_TRACE_FLAG_STATUS_BAR,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  NOTIFICATION_LIST_ITEM,
  QUICK_INPUT_LIST_ROW,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  TAB,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForQuickInputFirstOption
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';
import { waitForTraceFlagStatusBar } from '../helpers';

test('Log retrieval: get logs, open folder', async ({ page }) => {
  test.setTimeout(180_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const scriptName = `LogRetrieval${Date.now()}`;

  await test.step('setup minimal org auth', async () => {
    await setupMinimalOrgAndAuth(page);
    await ensureSecondarySideBarHidden(page);
  });

  await test.step('turn on trace flag (SOAP execAnon no longer creates trace; logGet needs ApexLog records)', async () => {
    await verifyCommandExists(page, packageNls['apexLog.command.traceFlagsCreateForCurrentUser'], 30_000);

    // Clean up any existing trace flags first (in case previous test failed to clean up)
    const statusBar = page.locator(APEX_TRACE_FLAG_STATUS_BAR);
    const hasExistingTrace = await statusBar.filter({ hasText: /Tracing until/ }).isVisible().catch(() => false);
    if (hasExistingTrace) {
      await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsDeleteForCurrentUser']);
      await waitForTraceFlagStatusBar(page, /No Tracing/);
    }

    // Now create the trace flag
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsCreateForCurrentUser']);
    await expect(page.locator(APEX_TRACE_FLAG_STATUS_BAR).filter({ hasText: /Tracing until/ })).toBeVisible({
      timeout: 60_000
    });
  });

  await test.step('generate log via execute anonymous apex', async () => {
    await verifyCommandExists(page, packageNls['apexLog.command.createAnonymousApexScript'], 30_000);
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.createAnonymousApexScript']);
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await quickInput.getByText(/Enter script name/i).waitFor({ state: 'visible', timeout: 5000 });
    await page.keyboard.type(scriptName);
    await page.keyboard.press('Enter');
    await waitForQuickInputFirstOption(page);
    await page.keyboard.press('Enter');
    const editor = page.locator(EDITOR_WITH_URI).first();
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    await editor.click();
    await editor.locator('.view-line').first().waitFor({ state: 'visible', timeout: 5000 });
    await executeCommandWithCommandPalette(page, 'Select All');
    await page.keyboard.press('Delete');
    await page.keyboard.type("System.debug('logtest');");
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.executeDocument']);
    const successNotification = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /executed successfully/i })
      .first();
    await expect(successNotification).toBeVisible({ timeout: 60_000 });
    await successNotification.getByRole('button', { name: /Open Log/i }).click();
    await expect(page.locator(TAB).filter({ hasText: /debug\.log/ })).toBeVisible({ timeout: 10_000 });
    await saveScreenshot(page, 'log-retrieval.executed.png');
  });

  await test.step('get apex debug log and verify quick pick shows entries', async () => {
    await verifyCommandExists(page, packageNls['apexLog.command.logGet'], 30_000);
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.logGet']);
    const widget = page.locator(QUICK_INPUT_WIDGET);
    await expect(widget).toBeVisible({ timeout: 30_000 });
    await waitForQuickInputFirstOption(page, {
      quickInputVisibleTimeout: 30_000,
      optionVisibleTimeout: 30_000,
      retryTimeout: 30_000
    });
    const firstAriaOption = widget.getByRole('option').first();
    const firstRow = (await firstAriaOption.count()) > 0 ? firstAriaOption : widget.locator(QUICK_INPUT_LIST_ROW).first();
    await firstRow.evaluate(el => {
      el.scrollIntoView({ block: 'center', behavior: 'instant' });
      (el as HTMLElement).click();
    });
    await saveScreenshot(page, 'log-retrieval.quick-pick.png');
  });

  await test.step('verify log file opens in editor', async () => {
    await expect(page.locator(TAB).filter({ hasText: /\.log$/ })).toBeVisible({ timeout: 15_000 });
    const editor = page.locator(EDITOR_WITH_URI).first();
    await expect(editor).toContainText(/logtest|USER_DEBUG|DEBUG/, { timeout: 10_000 });
    await saveScreenshot(page, 'log-retrieval.log-opened.png');
  });

  await test.step('open logs folder and verify explorer', async () => {
    // Ensure Explorer is visible (may already be open)
    const explorerHeading = page.getByRole('heading', { name: 'Explorer' }).first();
    const isExplorerVisible = await explorerHeading.isVisible().catch(() => false);
    if (!isExplorerVisible) {
      await executeCommandWithCommandPalette(page, 'View: Show Explorer');
    }
    await expect(explorerHeading).toBeVisible({ timeout: 10_000 });
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.openLogsFolder']);
    await expect(page.locator('[id="workbench.view.explorer"]')).toBeVisible({ timeout: 10_000 });
    await saveScreenshot(page, 'log-retrieval.explorer.png');
  });

  await test.step('turn off trace flag', async () => {
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsDeleteForCurrentUser']);
    await waitForTraceFlagStatusBar(page, /No Tracing/);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
