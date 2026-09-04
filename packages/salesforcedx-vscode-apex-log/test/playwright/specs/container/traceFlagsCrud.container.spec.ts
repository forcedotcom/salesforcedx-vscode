/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for trace-flag CRUD. The web twin (traceFlagsCrud.headless.spec.ts)
 * exercises the flow against a plain Page; this proves the create/delete of a current-user trace flag
 * and a debug level round-trip against the container's boot-authed org and surface in the virtual
 * traceFlags.json document — which web mode cannot cover.
 *
 * This spec mutates org-global debug levels / trace flags. The container config runs workers:1
 * serially, so exclusive access holds; the afterEach removes what it created.
 */

import { expect, type Page } from '@playwright/test';
import {
  APEX_TRACE_FLAG_STATUS_BAR,
  clearAllNotifications,
  closeAllEditors,
  closeSettingsTab,
  closeWelcomeTabs,
  CODELENS_ITEM,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  find,
  QUICK_INPUT_WIDGET,
  removeAllDebugLevels,
  saveScreenshot,
  selectFirstQuickInputOption,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';
import { waitForTraceFlagStatusBar } from '../../helpers';

/** Open find dialog via command palette, search for query, assert positive match count, close. */
const findInEditor = async (page: Page, query: string): Promise<void> => {
  const editor = page.locator(EDITOR_WITH_URI).first();
  await editor.click();
  await find(page);
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

// Shared persistent workbench: reset editors + notifications between specs.
test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

// Self-clean the org-global trace flag and debug level this spec creates, even if a step failed.
test.afterEach(async ({ page }) => {
  await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsDeleteForCurrentUser']).catch(
    () => {}
  );
  await removeAllDebugLevels(page).catch(() => {});
});

test('Trace Flags CRUD (Code Builder): open, create/delete current user trace flag, create/delete debug level', async ({
  page
}) => {
  test.setTimeout(4 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const debugLevelMasterLabel = `TraceCrud${Date.now()}`;
  const debugLevelDeveloperName = debugLevelMasterLabel.slice(0, 40);

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await closeSettingsTab(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'traceFlagsCrud.container.01-ready.png');
  });

  await test.step('remove all debug levels so ReplayDebuggerLevels is auto-created', async () => {
    await removeAllDebugLevels(page);
  });

  await test.step('cleanup stale trace flags from prior runs', async () => {
    await verifyCommandExists(page, packageNls['apexLog.command.traceFlagsOpen'], 30_000);
    const removeLink = page
      .locator(CODELENS_ITEM)
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
    await saveScreenshot(page, 'traceFlagsCrud.container.02-opened.png');
  });

  await test.step('create trace flag for current user and verify status bar + code lens', async () => {
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsCreateForCurrentUser']);
    await expect(page.locator(APEX_TRACE_FLAG_STATUS_BAR).filter({ hasText: /Tracing until/ })).toBeVisible({
      timeout: 60_000
    });

    await openTraceFlagsAndExpectContent(page, '"DEVELOPER_LOG"');
    await expect(
      page
        .locator(CODELENS_ITEM)
        .filter({ hasText: /^Remove$/ })
        .first()
    ).toBeVisible({
      timeout: 30_000
    });
    await saveScreenshot(page, 'traceFlagsCrud.container.03-created.png');
  });

  await test.step('create debug level and verify it appears in virtual document', async () => {
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsCreateLogLevel']);

    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await page.keyboard.type(debugLevelMasterLabel);
    await page.keyboard.press('Enter');

    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await quickInput.locator('input.input').fill(debugLevelDeveloperName);
    await page.keyboard.press('Enter');

    await selectFirstQuickInputOption(page, { optionVisibleTimeout: 10_000 });

    await openTraceFlagsAndExpectContent(page, debugLevelMasterLabel);
    await saveScreenshot(page, 'traceFlagsCrud.container.04-debug-level-created.png');
  });

  await test.step('cleanup: delete current-user trace flag', async () => {
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsDeleteForCurrentUser']);
    await waitForTraceFlagStatusBar(page, /No Tracing/);
    await saveScreenshot(page, 'traceFlagsCrud.container.05-trace-flag-cleanup.png');
  });

  await test.step('cleanup: delete created debug level', async () => {
    await removeAllDebugLevels(page);
    await saveScreenshot(page, 'traceFlagsCrud.container.06-debug-level-cleanup.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
