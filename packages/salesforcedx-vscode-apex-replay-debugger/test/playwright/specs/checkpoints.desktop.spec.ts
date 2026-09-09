/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from '@playwright/test';
import {
  APEX_TRACE_FLAG_STATUS_BAR,
  clearOutputChannel,
  countOutputChannelOptions,
  createAndOpenApexScript,
  createApexClass,
  EDITOR_WITH_URI,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  NOTIFICATION_LIST_ITEM,
  openFileByName,
  removeAllDebugLevels,
  saveScreenshot,
  selectOutputChannel,
  selectQuickInputOptionByTyping,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForOutputChannelText,
  WORKBENCH
} from '@salesforce/playwright-vscode-ext';

import apexLogNls from 'salesforcedx-vscode-apex-log/package.nls.json';
import metadataNls from 'salesforcedx-vscode-metadata/package.nls.json';
import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';
import { continueDebugSession } from '../helpers/debugHelpers';

// Localized fragment of the base adapter's `heap_dump_error_wrap_up_text` (salesforcedx-apex-replay-debugger
// i18n) — emitted to the Debug Console only when host↔adapter heapDumpResults wiring fails.
const HEAP_DUMP_ERROR_TEXT = /Problems were encountered while retrieving heap dump information/;

test('Checkpoints: Toggle Checkpoint and Update Checkpoints in Org', async ({ page }) => {
  test.setTimeout(600_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const accountServiceContent = [
    'public with sharing class AccountService {',
    '  public Account createAccount(String accountName, String accountNumber, String tickerSymbol) {',
    '    Account newAcct = new Account(',
    '      Name = accountName,',
    '      AccountNumber = accountNumber,',
    '      TickerSymbol = accountNumber',
    '    );',
    '    return newAcct;',
    '  }',
    '}'
  ].join('\n');

  await test.step('setup minimal org and deploy AccountService', async () => {
    await setupMinimalOrgAndAuth(page);
    await ensureSecondarySideBarHidden(page);
    await createApexClass(page, 'AccountService', accountServiceContent);
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await executeCommandWithCommandPalette(
      page,
      metadataNls.project_deploy_start_ignore_conflicts_default_org_text as string
    );
    await waitForOutputChannelText(page, { expectedText: 'Starting metadata deployment', timeout: 30_000 });
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: 120_000 });
  });

  await test.step('toggle checkpoint at the `return newAcct;` line of AccountService.cls', async () => {
    await openFileByName(page, 'AccountService.cls');

    // Click directly on the `return newAcct;` line text — `sfToggleCheckpoint` reads
    // `vscode.window.activeTextEditor.selection.start.line`, so the caret must sit on a valid
    // Apex statement (not the closing `}` on line 10). Scope to the AccountService editor so
    // the click can't land in a different editor's view-lines.
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="AccountService.cls"]`);
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    const returnLine = editor.locator('.view-line').filter({ hasText: 'return newAcct;' }).first();
    await expect(returnLine).toBeVisible({ timeout: 15_000 });
    await returnLine.click();

    // Use preserveSelection so the palette opener does not click the workbench root
    // (a workbench-center click can land in the editor and reset the cursor before the
    // Toggle Checkpoint command reads `activeTextEditor.selection.start.line`).
    await executeCommandWithCommandPalette(page, packageNls.sf_toggle_checkpoint as string, undefined, {
      preserveSelection: true
    });

    // After Toggle Checkpoint, VS Code renders a conditional breakpoint glyph in the gutter
    const checkpointGlyph = page.locator('div.codicon-debug-breakpoint-conditional');
    await expect(checkpointGlyph.first()).toBeVisible({ timeout: 15_000 });
    await saveScreenshot(page, 'step.checkpoint-toggled.png');
  });

  await test.step('update checkpoints in org', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Replay Debugger');
    // Dedupe guard: debugger output goes through the single services-owned channel, so activation
    // must not add a second channel with the same name (W-23465461).
    const channelCount = await countOutputChannelOptions(page, 'Apex Replay Debugger');
    expect(channelCount, "expected exactly one 'Apex Replay Debugger' output channel").toBe(1);
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, packageNls.sf_update_checkpoints_in_org as string);

    await waitForOutputChannelText(page, {
      expectedText: 'SFDX: Update Checkpoints in Org, Step 6 of 6: Confirming successful checkpoint creation',
      timeout: 120_000
    });
    await waitForOutputChannelText(page, {
      expectedText: 'Ended SFDX: Update Checkpoints in Org',
      timeout: 60_000
    });
    await saveScreenshot(page, 'step.checkpoints-updated.png');
  });

  // The steps below restore the heap-dump replay flow dropped in the WDIO→Playwright port
  // (old trailApexReplayDebugger.e2e.ts). They exercise the host-side overlay fetch + the
  // host↔adapter `heapDumpResults` wiring + the multi-dump fetch fix (W-23355895).
  await test.step('remove all debug levels so ReplayDebuggerLevels is auto-created', async () => {
    await removeAllDebugLevels(page);
  });

  await test.step('create trace flag for current user', async () => {
    await executeCommandWithCommandPalette(
      page,
      apexLogNls['apexLog.command.traceFlagsCreateForCurrentUser'] as string
    );
    const statusBar = page.locator(APEX_TRACE_FLAG_STATUS_BAR).filter({ hasText: /Tracing until/ });
    await expect(statusBar).toBeVisible({ timeout: 60_000 });
  });

  await test.step('exec anon that hits the checkpoint line so the org captures a heap dump', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Apex Log');
    await clearOutputChannel(page);

    await createAndOpenApexScript(page, {
      name: 'RunCheckpoint',
      content: "new AccountService().createAccount('Acme', '123', 'ACME');"
    });

    await page.keyboard.press('F1');
    await selectQuickInputOptionByTyping(page, apexLogNls['apexLog.command.executeDocument'] as string);

    const successNotification = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /executed successfully/i })
      .first();
    await expect(successNotification).toBeVisible({ timeout: 30_000 });
    await successNotification.getByRole('button', { name: /Open Log/i }).click();
    const logTab = page.locator('.tab').filter({ hasText: /\.log$/ });
    await expect(logTab).toBeVisible({ timeout: 10_000 });
    await saveScreenshot(page, 'step.checkpoint-exec-anon-done.png');
  });

  await test.step('launch replay against the heap-dump log and assert no heap_dump_error', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Replay Debugger');
    await clearOutputChannel(page);

    const logTab = page.locator('.tab').filter({ hasText: /\.log$/ });
    await logTab.click({ force: true });
    await executeCommandWithCommandPalette(page, packageNls.launch_apex_replay_debugger_with_selected_file as string);
    // Replay pauses on entry first (debug toolbar appears), then continue through the heap-dump line.
    await expect(page.locator('.debug-toolbar')).toBeVisible({ timeout: 30_000 });
    await continueDebugSession(page, 3);

    // Regression guard: the Apex Replay Debugger output/Debug Console must NOT contain the
    // heap-dump error wrap-up text. Its presence means the host fetch failed or the
    // heapDumpResults never reached the adapter.
    await expect(
      page.locator(`${WORKBENCH} .repl .monaco-list-row`).filter({ hasText: HEAP_DUMP_ERROR_TEXT })
    ).toHaveCount(0);
    await saveScreenshot(page, 'step.checkpoint-replay-done.png');
  });

  await test.step('turn off trace flag', async () => {
    await executeCommandWithCommandPalette(
      page,
      apexLogNls['apexLog.command.traceFlagsDeleteForCurrentUser'] as string
    );
    const statusBar = page.locator(APEX_TRACE_FLAG_STATUS_BAR).filter({ hasText: /No Tracing/ });
    await expect(statusBar).toBeVisible({ timeout: 30_000 });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
