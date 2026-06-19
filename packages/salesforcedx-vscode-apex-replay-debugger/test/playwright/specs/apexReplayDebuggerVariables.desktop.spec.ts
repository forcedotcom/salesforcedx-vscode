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
  createApexClass,
  EDITOR_WITH_URI,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  NOTIFICATION_LIST_ITEM,
  openFileByName,
  QUICK_INPUT_WIDGET,
  removeAllDebugLevels,
  saveScreenshot,
  selectOutputChannel,
  selectQuickInputOptionByTyping,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForOutputChannelText,
  waitForQuickInputFirstOption,
  WORKBENCH
} from '@salesforce/playwright-vscode-ext';

import apexLogNls from 'salesforcedx-vscode-apex-log/package.nls.json';
import metadataNls from 'salesforcedx-vscode-metadata/package.nls.json';
import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';

// Class that builds nested SObject relationships in memory so they serialize as a
// nested-object VARIABLE_ASSIGNMENT (`{"Account":{"Name":"Acme"}}`) in the debug log.
// System.debug on the line below is the breakpoint target.
const nestedClassContent = [
  'public with sharing class NestedRelExample {',
  '  public static void build() {',
  "    Account a = new Account(Name = 'Acme');",
  "    Contact c = new Contact(LastName = 'Bond', Account = a);",
  '    System.debug(c);',
  '  }',
  '}'
].join('\n');

test('Apex Replay Debugger: nested related-object VARIABLES expand (no [object Object])', async ({ page }) => {
  test.setTimeout(600_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup minimal org with NestedRelExample', async () => {
    await setupMinimalOrgAndAuth(page);
    await ensureSecondarySideBarHidden(page);
    await createApexClass(page, 'NestedRelExample', nestedClassContent);
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await executeCommandWithCommandPalette(
      page,
      metadataNls.project_deploy_start_ignore_conflicts_default_org_text as string
    );
    await waitForOutputChannelText(page, { expectedText: 'Starting metadata deployment', timeout: 90_000 });
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: 120_000 });
  });

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

  await test.step('exec anon invoking NestedRelExample.build', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Apex Log');
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, apexLogNls['apexLog.command.createAnonymousApexScript'] as string);
    await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'visible', timeout: 10_000 });
    await page.keyboard.type('RunNested');
    await page.keyboard.press('Enter');
    // Name InputBox transitions to a directory QuickPick (2 options) — accept the first
    await waitForQuickInputFirstOption(page);
    await page.keyboard.press('Enter');

    await page
      .locator('.tab')
      .filter({ hasText: /RunNested\.apex/ })
      .waitFor({ state: 'visible', timeout: 15_000 });
    await openFileByName(page, 'RunNested.apex');
    const editorArea = page.locator('.editor-instance .view-lines').first();
    await editorArea.click({ force: true });
    await page.keyboard.press('Control+a');
    await page.keyboard.type('NestedRelExample.build();');

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
    await saveScreenshot(page, 'step.nested-exec-anon-done.png');
  });

  await test.step('set breakpoint on the System.debug line in NestedRelExample', async () => {
    await openFileByName(page, 'NestedRelExample.cls');
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="NestedRelExample.cls"]`);
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    const debugLine = editor.locator('.view-line').filter({ hasText: 'System.debug(c);' }).first();
    await expect(debugLine).toBeVisible({ timeout: 15_000 });
    await debugLine.click();
    // F9 toggles a breakpoint at the current caret line
    await page.keyboard.press('F9');
    const breakpointGlyph = page.locator('div.codicon-debug-breakpoint');
    await expect(breakpointGlyph.first()).toBeVisible({ timeout: 15_000 });
  });

  await test.step('launch replay debugger with selected log file and pause at breakpoint', async () => {
    const logTab = page.locator('.tab').filter({ hasText: /\.log$/ });
    await logTab.click({ force: true });
    await executeCommandWithCommandPalette(page, packageNls.launch_apex_replay_debugger_with_selected_file as string);
    // Replay pauses on entry first (debug toolbar appears)
    await expect(page.locator('.debug-toolbar')).toBeVisible({ timeout: 30_000 });
    // Continue (F5) to run to the breakpoint on the System.debug line where `c` is assigned
    await page.keyboard.press('F5');
    // Confirm we paused at NestedRelExample.cls line 5 (not entry) via the call stack frame
    await executeCommandWithCommandPalette(page, 'View: Show Run and Debug');
    const stackFrame = page.locator('.debug-call-stack .monaco-list-row').filter({ hasText: /NestedRelExample/ });
    await expect(stackFrame.first()).toBeVisible({ timeout: 30_000 });
    await saveScreenshot(page, 'step.replay-paused.png');
  });

  await test.step('assert nested local expands and renders no [object Object]', async () => {
    // Launching replay does not open the Run and Debug viewlet — show it, then focus VARIABLES.
    await executeCommandWithCommandPalette(page, 'View: Show Run and Debug');
    await executeCommandWithCommandPalette(page, 'Run and Debug: Focus on Variables View');
    const variablesView = page.locator(`${WORKBENCH} .debug-variables`);
    await variablesView.waitFor({ state: 'visible', timeout: 30_000 });

    // The replay Variables tree shows scope rows (Local/Static); expand any collapsed scope so
    // the locals (Contact `c`) are rendered.
    const collapsedScopes = variablesView.locator('.monaco-list-row[aria-expanded="false"]');
    const collapsedCount = await collapsedScopes.count();
    for (let i = 0; i < collapsedCount; i++) {
      await collapsedScopes.nth(i).locator('.monaco-tl-twistie').click({ force: true });
    }

    // The Contact local `c` carries the nested Account relationship. Match the variable-name cell.
    const nestedRow = variablesView
      .locator('.monaco-list-row')
      .filter({ has: page.locator('.monaco-highlighted-label', { hasText: /^c$/ }) })
      .first();
    await expect(nestedRow).toBeVisible({ timeout: 30_000 });

    // Symptom assertion: nested value must not render as [object Object]
    await expect(nestedRow).not.toContainText('[object Object]');

    // Expand twistie present (collapsible affordance)
    const twistie = nestedRow.locator('.monaco-tl-twistie');
    await expect(twistie).toBeVisible({ timeout: 10_000 });

    // Expand and confirm a child property row becomes visible
    await twistie.click({ force: true });
    const childRow = variablesView
      .locator('.monaco-list-row')
      .filter({ hasText: /LastName|Account/ })
      .first();
    await expect(childRow).toBeVisible({ timeout: 15_000 });

    // No row anywhere renders [object Object]
    await expect(variablesView.locator('.monaco-list-row', { hasText: '[object Object]' })).toHaveCount(0);
    await saveScreenshot(page, 'step.nested-variables-expanded.png');
  });

  await test.step('continue and end debug session', async () => {
    const toolbar = page.locator('.debug-toolbar');
    // Click editor area to dismiss search-bar hover that can cover debug toolbar and block F5
    await page.locator(`${WORKBENCH} .editor-instance .view-lines`).first().click({ force: true });
    await page.keyboard.press('Escape');
    await page.keyboard.press('F5');
    await expect(toolbar).not.toBeVisible({ timeout: 45_000 });
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
