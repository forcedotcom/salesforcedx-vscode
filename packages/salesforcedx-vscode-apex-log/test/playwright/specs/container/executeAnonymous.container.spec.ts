/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for anonymous Apex execution (ADR 0022). The web twin
 * (executeAnonymous.headless.spec.ts) proves the flow against a plain Page; this proves anonymous
 * Apex actually executes against the org from inside the Code Builder image, using the container's
 * boot-authed org. The debug marker returned in the Apex Log channel confirms the round-trip
 * (extension → sf → org → log), which web mode cannot cover. Beyond the execute-document scenario
 * it restores the twin's selection, compile-error, and diagnostics scenarios so container parity is
 * complete — each asserts on durable output-channel / diagnostics signals rather than transient UI.
 */

import { expect } from '@playwright/test';
import {
  clearAllNotifications,
  closeWelcomeTabs,
  EDITOR_WITH_URI,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  expectProblemsCountAtLeast,
  NOTIFICATION_LIST_ITEM,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  selectAll,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText,
  waitForQuickInputFirstOption
} from '@salesforce/playwright-vscode-ext';
import { messages } from '../../../../src/messages/i18n';
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

const APEX_LOG_CHANNEL = 'Salesforce Apex Log';
// Distinct markers per scenario: the Apex Log channel accumulates within a run, so each scenario
// asserts on its own marker to prove that specific execution round-tripped through the boot org.
const DEBUG_MARKER = 'cbE2eAnon';
const SELECTION_MARKER = 'cbE2eSel';
const FIXED_MARKER = 'cbE2eFixed';

// The `.apex` editor is the only text editor this spec opens (we never click "Open Log"), so
// targeting the `.apex` URI keeps the editor locator unambiguous across every step.
const APEX_EDITOR = `${EDITOR_WITH_URI}[data-uri$=".apex"]`;

test('Execute Anonymous Apex (Code Builder): document, selection, compile error, diagnostics against the boot org', async ({
  page
}) => {
  test.setTimeout(5 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  // Unique name so repeated runs on the shared workbench never collide with a prior scaffold.
  const scriptName = `CbE2eAnon${Date.now()}`;

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'execAnon.container.01-ready.png');
  });

  await test.step('create an anonymous Apex script', async () => {
    await verifyCommandExists(page, packageNls['apexLog.command.createAnonymousApexScript'], 120_000);
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.createAnonymousApexScript']);

    // The command prompts (showInputBox) for a script name before it scaffolds anything — the earlier
    // port skipped this, so the `.apex` editor never opened. Fill the name and confirm.
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
    await quickInput.getByText(messages.create_script_name_prompt).waitFor({ state: 'visible', timeout: 15_000 });
    await quickInput.locator('input.input').first().fill(scriptName);
    await page.keyboard.press('Enter');

    // Then it prompts for the output directory (default `scripts/apex`) — accept the first option.
    await quickInput.waitFor({ state: 'visible', timeout: 15_000 });
    await waitForQuickInputFirstOption(page);
    await page.keyboard.press('Enter');

    // Now the command writes the template and opens the scaffolded `.apex` file in the editor.
    await page.locator(APEX_EDITOR).first().waitFor({ state: 'visible', timeout: 30_000 });
  });

  await test.step('execute the open document and assert the debug marker round-trips', async () => {
    // Select the whole template body, then type over it so the buffer is exactly our statement.
    await page.locator(APEX_EDITOR).first().click();
    await selectAll(page);
    await page.keyboard.press('Delete');
    await page.keyboard.type(`System.debug('${DEBUG_MARKER}');`);
    await saveScreenshot(page, 'execAnon.container.02-typed.png');

    await verifyCommandExists(page, packageNls['apexLog.command.executeDocument'], 30_000);
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.executeDocument']);

    const successNotification = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /executed successfully/i })
      .first();
    await expect(successNotification).toBeVisible({ timeout: 120_000 });

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, APEX_LOG_CHANNEL);
    // USER_DEBUG proves the org actually ran the anonymous block and returned its log.
    await waitForOutputChannelText(page, { expectedText: 'USER_DEBUG', timeout: 60_000 });
    await waitForOutputChannelText(page, { expectedText: DEBUG_MARKER, timeout: 10_000 });
    await saveScreenshot(page, 'execAnon.container.03-document.png');
  });

  await test.step('select first line and execute selection', async () => {
    // Fresh, honest notification state so the selection success below can't match the document run's.
    await clearAllNotifications(page);

    const editor = page.locator(APEX_EDITOR).first();
    await editor.click();
    await selectAll(page);
    await page.keyboard.press('Delete');
    // Two lines with distinct markers: selecting only the first proves the SELECTION (not the whole
    // document) executed — the first marker round-trips, so we assert on it in the channel.
    await page.keyboard.type(`System.debug('${SELECTION_MARKER}');\nSystem.debug('cbE2eSelSecond');`);

    // Triple-click is a native Monaco gesture that both focuses the editor and selects the whole
    // line — more reliable on web than click + Ctrl/Cmd+A (which can produce a browser-level DOM
    // selection instead of a Monaco selection).
    await editor.locator('.view-line').first().click({ clickCount: 3 });
    // VS Code's status bar shows "(N selected)" only when the active editor has a real, non-empty
    // Monaco selection; failing fast here is cheaper than a 30s palette-command timeout.
    await expect(
      page
        .locator('.statusbar-item')
        .filter({ hasText: /\(\d+ selected\)/ })
        .first()
    ).toBeVisible({ timeout: 5000 });

    // preserveSelection: skip the focus-click / palette-input clicks / Escape dismiss that would
    // otherwise collapse the selection and make `editorHasSelection` false (hiding the command).
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.executeSelection'], undefined, {
      preserveSelection: true
    });

    const successNotification = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /executed successfully/i })
      .first();
    await expect(successNotification).toBeVisible({ timeout: 120_000 });

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, APEX_LOG_CHANNEL);
    await waitForOutputChannelText(page, { expectedText: 'USER_DEBUG', timeout: 60_000 });
    await waitForOutputChannelText(page, { expectedText: SELECTION_MARKER, timeout: 10_000 });
    await saveScreenshot(page, 'execAnon.container.04-selection.png');
  });

  await test.step('execute with a compile error and verify the error notification', async () => {
    await clearAllNotifications(page);

    const editor = page.locator(APEX_EDITOR).first();
    await editor.click();
    await selectAll(page);
    await page.keyboard.press('Delete');
    await page.keyboard.type("Integer x = 'bad';");
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.executeDocument']);

    // The compile failure surfaces a notification carrying the org's Line/Column diagnostic.
    const errorNotification = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /Line \d+.*Column \d+/ })
      .first();
    await expect(errorNotification).toBeVisible({ timeout: 60_000 });
    await saveScreenshot(page, 'execAnon.container.05-compile-error.png');
  });

  await test.step('fix code, re-execute, verify diagnostics were raised then execution succeeds', async () => {
    // The compile error published at least one diagnostic to the Problems panel — a durable signal.
    await expectProblemsCountAtLeast(page, 1, { timeout: 30_000 });

    await clearAllNotifications(page);
    const editor = page.locator(APEX_EDITOR).first();
    await editor.click();
    await selectAll(page);
    await page.keyboard.press('Delete');
    await page.keyboard.type(`System.debug('${FIXED_MARKER}');`);
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.executeDocument']);

    const successNotification = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /executed successfully/i })
      .first();
    await expect(successNotification).toBeVisible({ timeout: 120_000 });

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, APEX_LOG_CHANNEL);
    await waitForOutputChannelText(page, { expectedText: 'USER_DEBUG', timeout: 60_000 });
    await waitForOutputChannelText(page, { expectedText: FIXED_MARKER, timeout: 10_000 });
    await saveScreenshot(page, 'execAnon.container.06-fixed.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
