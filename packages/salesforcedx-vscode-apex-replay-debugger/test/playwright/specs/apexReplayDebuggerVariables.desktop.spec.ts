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
  createAndOpenApexScript,
  createApexClass,
  EDITOR_WITH_URI,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  expandAllVariableScopes,
  expandNestedVariable,
  focusMonacoInput,
  getCallStackRows,
  getVariableRow,
  NOTIFICATION_LIST_ITEM,
  openFileByName,
  openVariablesView,
  removeAllDebugLevels,
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
  selectQuickInputOptionByTyping,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  showRunAndDebugView,
  stopDebugSession,
  validateNoCriticalErrors,
  waitForOutputChannelText,
  WORKBENCH
} from '@salesforce/playwright-vscode-ext';

import apexLogNls from 'salesforcedx-vscode-apex-log/package.nls.json';
import metadataNls from 'salesforcedx-vscode-metadata/package.nls.json';
import packageNls from '../../../package.nls.json';
import { isContainer, sharedTest as test } from '../fixtures';

// Class that builds nested SObject relationships in memory so they serialize as a
// nested-object VARIABLE_ASSIGNMENT (`{"Account":{"Name":"Acme"}}`) in the debug log.
// System.debug on the line below is the breakpoint target.
const nestedClassContent = (className: string) =>
  [
    `public with sharing class ${className} {`,
    '  public static void build() {',
    "    Account a = new Account(Name = 'Acme');",
    "    Contact c = new Contact(LastName = 'Bond', Account = a);",
    '    System.debug(c);',
    '  }',
    '}'
  ].join('\n');

// No org setup on the container's shared, persistent workbench — every test uses the boot (default)
// org, and editors/notifications are reset before each test rather than assuming a clean slate.
test.beforeEach(async ({ page }) => {
  if (isContainer) {
    await resetContainerWorkbench(page);
  }
});

// Stop the session AND remove all breakpoints — a leaked breakpoint would pause an unrelated later
// spec's replay on the container's shared workbench. Best-effort.
test.afterEach(async ({ page }) => {
  if (isContainer) {
    await stopDebugSession(page);
    await executeCommandWithCommandPalette(page, 'Debug: Remove All Breakpoints').catch(() => {});
  }
});

test('Apex Replay Debugger Variables: nested related-object VARIABLES expand (no [object Object])', async ({
  page
}) => {
  test.setTimeout(600_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const className = isContainer ? `NestedRelExample_${Date.now().toString(36)}` : 'NestedRelExample';
  const scriptName = isContainer ? `RunNested_${Date.now().toString(36)}` : 'RunNested';

  await test.step('setup with NestedRelExample', async () => {
    if (!isContainer) {
      await setupMinimalOrgAndAuth(page);
    }
    await ensureSecondarySideBarHidden(page);
    await createApexClass(page, className, nestedClassContent(className));
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await executeCommandWithCommandPalette(
      page,
      metadataNls.project_deploy_start_ignore_conflicts_default_org_text as string
    );
    await waitForOutputChannelText(page, { expectedText: 'Starting metadata deployment', timeout: 90_000 });
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: 120_000 });
    await saveScreenshot(page, 'setup.class-deployed.png');
  });

  const setupNestedExampleContainer = async (): Promise<void> => {
    // Drives the anon debug delegate directly: "Launch Apex Replay Debugger with Selected File" on a
    // `.apex` script execs the anon apex at Apex_code=Finest (full VARIABLE_ASSIGNMENT detail), writes
    // the log, and launches replay in one command — no manual trace-flag setup needed.
    await test.step('create an anon script that invokes the class .build()', async () => {
      await createAndOpenApexScript(page, { name: scriptName, content: `${className}.build();` });
      await saveScreenshot(page, 'setup.run-script-open.png');
    });
  };
  const setupNestedExampleDesktop = async (): Promise<void> => {
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

      await createAndOpenApexScript(page, {
        name: scriptName,
        content: `${className}.build();`
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
      await saveScreenshot(page, 'step.nested-exec-anon-done.png');
    });
  };
  await (isContainer ? setupNestedExampleContainer : setupNestedExampleDesktop)();

  await test.step('set breakpoint on the System.debug line in the class', async () => {
    await openFileByName(page, `${className}.cls`);
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${className}.cls"]`);
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    const waitForIndexingCompleteContainer = async (): Promise<void> => {
      // The breakpoint only BINDS (and replay pauses on it) once the Apex LS has indexed the class and
      // can supply its line-breakpoint typeRefs. On a cold code-server the LS is still indexing, so gate
      // on the Apex language-status "Indexing complete" button — it renders only while an Apex editor is
      // active (the .cls above is), which is why it must be waited on here, not after a deploy.
      await expect(page.getByRole('button', { name: /Indexing complete/ })).toBeVisible({ timeout: 120_000 });
    };
    const waitForIndexingCompleteDesktop = async (): Promise<void> => {};
    await (isContainer ? waitForIndexingCompleteContainer : waitForIndexingCompleteDesktop)();
    const debugLine = editor.locator('.view-line').filter({ hasText: 'System.debug(c);' }).first();
    await expect(debugLine).toBeVisible({ timeout: 15_000 });
    await debugLine.click();
    // F9 toggles a breakpoint at the current caret line
    await page.keyboard.press('F9');
    const breakpointGlyph = page.locator('div.codicon-debug-breakpoint');
    await expect(breakpointGlyph.first()).toBeVisible({ timeout: 15_000 });
  });

  const launchReplayAndPauseContainer = async (): Promise<void> => {
    await test.step('launch replay via the anon script and pause at the breakpoint', async () => {
      await openFileByName(page, `${scriptName}.apex`);
      await executeCommandWithCommandPalette(page, packageNls.launch_apex_replay_debugger_with_selected_file as string);
      // Replay pauses on entry first (debug toolbar appears)
      await expect(page.locator('.debug-toolbar')).toBeVisible({ timeout: 60_000 });
      // Continue (F5) to run to the breakpoint on the System.debug line where `c` is assigned
      await page.keyboard.press('F5');
      // Confirm we paused in the class (not entry) via the call stack frame
      await showRunAndDebugView(page);
      const stackFrame = getCallStackRows(page).filter({ hasText: new RegExp(className) });
      await expect(stackFrame.first()).toBeVisible({ timeout: 30_000 });
      await saveScreenshot(page, 'step.replay-paused.png');
    });
  };
  const launchReplayAndPauseDesktop = async (): Promise<void> => {
    await test.step('launch replay debugger with selected log file and pause at breakpoint', async () => {
      const logTab = page.locator('.tab').filter({ hasText: /\.log$/ });
      await expect(logTab).toBeVisible({ timeout: 10_000 });
      await logTab.click();
      await executeCommandWithCommandPalette(page, packageNls.launch_apex_replay_debugger_with_selected_file as string);
      // Replay pauses on entry first (debug toolbar appears)
      await expect(page.locator('.debug-toolbar')).toBeVisible({ timeout: 30_000 });
      // Continue (F5) to run to the breakpoint on the System.debug line where `c` is assigned
      await page.keyboard.press('F5');
      // Confirm we paused (not entry) via the call stack frame
      await executeCommandWithCommandPalette(page, 'View: Show Run and Debug');
      const stackFrame = page.locator('.debug-call-stack .monaco-list-row').filter({ hasText: new RegExp(className) });
      await expect(stackFrame.first()).toBeVisible({ timeout: 30_000 });
      await saveScreenshot(page, 'step.replay-paused.png');
    });
  };
  await (isContainer ? launchReplayAndPauseContainer : launchReplayAndPauseDesktop)();

  await test.step('assert nested local expands and renders no [object Object]', async () => {
    const variablesView = await openVariablesView(page);
    await expandAllVariableScopes(variablesView);

    // The Contact local `c` carries the nested Account relationship.
    const nestedRow = getVariableRow(variablesView, page, 'c');
    await expect(nestedRow).toBeVisible({ timeout: 30_000 });
    // This is the symptom this test exists to catch.
    await expect(nestedRow).not.toContainText('[object Object]');

    const twistie = nestedRow.locator('.monaco-tl-twistie');
    await expect(twistie).toBeVisible({ timeout: 10_000 });

    // Expand `c` and confirm a child property row (LastName/Account) becomes visible.
    await expandNestedVariable(page, variablesView, nestedRow, /LastName|Account/);

    await expect(variablesView.locator('.monaco-list-row', { hasText: '[object Object]' })).toHaveCount(0);
    await saveScreenshot(page, 'step.nested-variables-expanded.png');
  });

  await test.step('continue and end debug session', async () => {
    if (isContainer) {
      // Click editor area to dismiss search-bar hover that can cover debug toolbar and block F5.
      // eslint-disable-next-line playwright/no-force-option -- clicking through the covering hover is the point
      await page.locator(`${WORKBENCH} .editor-instance .view-lines`).first().click({ force: true });
    } else {
      // Focus the editor input so a search-bar hover cannot take F5
      await focusMonacoInput(page.locator(`${WORKBENCH} .editor-instance .monaco-editor`).first());
    }
    await page.keyboard.press('Escape');
    await page.keyboard.press('F5');
    await expect(page.locator('.debug-toolbar')).not.toBeVisible({ timeout: 45_000 });
  });

  const turnOffTraceFlagDesktop = async (): Promise<void> => {
    await test.step('turn off trace flag', async () => {
      await executeCommandWithCommandPalette(
        page,
        apexLogNls['apexLog.command.traceFlagsDeleteForCurrentUser'] as string
      );
      const statusBar = page.locator(APEX_TRACE_FLAG_STATUS_BAR).filter({ hasText: /No Tracing/ });
      await expect(statusBar).toBeVisible({ timeout: 30_000 });
    });
  };
  const turnOffTraceFlagContainer = async (): Promise<void> => {};
  await (isContainer ? turnOffTraceFlagContainer : turnOffTraceFlagDesktop)();

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
