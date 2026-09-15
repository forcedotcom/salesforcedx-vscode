/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container twin of apexReplayDebuggerVariables.desktop (ADR 0022, W-23898526) — the highest-value
 * interactive replay case: a breakpoint (F9) in a deployed class, replay pauses there, and a nested
 * related-object local (`Contact c` carrying `Account`) expands in the VARIABLES tree with no
 * "[object Object]". Runs against the container's boot (default target) org.
 *
 * Rather than a manual trace flag + separate exec-anon (the desktop path), it drives the anonymous
 * debug delegate: "Launch Apex Replay Debugger with Selected File" on a `.apex` script that calls
 * the deployed class. The delegate execs the anon apex at Apex_code=Finest (full VARIABLE_ASSIGNMENT
 * detail), writes the log, and launches replay in one command — so no trace-flag setup is needed.
 * Hardened for the shared, persistent workbench: unique per-run names, a beforeEach reset, and an
 * afterEach that stops the session AND removes all breakpoints so they can't poison the next test.
 */

import { expect } from '@playwright/test';
import {
  activateEditorTab,
  createApexClass,
  createAndOpenApexScript,
  EDITOR_WITH_URI,
  ensureOutputPanelOpen,
  executeCommandWithCommandPalette,
  expandAllVariableScopes,
  expandNestedVariable,
  getCallStackRows,
  getVariableRow,
  openVariablesView,
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  showRunAndDebugView,
  stopDebugSession,
  validateNoCriticalErrors,
  waitForOutputChannelText,
  WORKBENCH
} from '@salesforce/playwright-vscode-ext';

import metadataNls from 'salesforcedx-vscode-metadata/package.nls.json';
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

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

test.beforeEach(async ({ page }) => {
  await resetContainerWorkbench(page);
});

// Stop the session AND remove all breakpoints — a leaked breakpoint would pause an unrelated later
// spec's replay on the same shared workbench. Best-effort.
test.afterEach(async ({ page }) => {
  await stopDebugSession(page);
  await executeCommandWithCommandPalette(page, 'Debug: Remove All Breakpoints').catch(() => {});
});

test('Apex Replay Debugger Variables (Code Builder): nested related-object VARIABLES expand (no [object Object])', async ({
  page
}) => {
  test.setTimeout(600_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const className = `NestedRelExample_${Date.now().toString(36)}`;
  const scriptName = `RunNested_${Date.now().toString(36)}`;

  await test.step('deploy NestedRelExample to the boot org', async () => {
    await createApexClass(page, className, nestedClassContent.replaceAll('NestedRelExample', className));
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

  await test.step('create an anon script that invokes the class .build()', async () => {
    await createAndOpenApexScript(page, { name: scriptName, content: `${className}.build();` });
    await saveScreenshot(page, 'setup.run-script-open.png');
  });

  await test.step('set breakpoint on the System.debug line in the class', async () => {
    await activateEditorTab(page, `${className}.cls`);
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${className}.cls"]`);
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    // The breakpoint only BINDS (and replay pauses on it) once the Apex LS has indexed the class and
    // can supply its line-breakpoint typeRefs. On a cold code-server the LS is still indexing, so gate
    // on the Apex language-status "Indexing complete" button — it renders only while an Apex editor is
    // active (the .cls above is), which is why it must be waited on here, not after a deploy.
    await expect(page.getByRole('button', { name: /Indexing complete/ })).toBeVisible({ timeout: 120_000 });
    const debugLine = editor.locator('.view-line').filter({ hasText: 'System.debug(c);' }).first();
    await expect(debugLine).toBeVisible({ timeout: 15_000 });
    await debugLine.click();
    // F9 toggles a breakpoint at the current caret line
    await page.keyboard.press('F9');
    const breakpointGlyph = page.locator('div.codicon-debug-breakpoint');
    await expect(breakpointGlyph.first()).toBeVisible({ timeout: 15_000 });
  });

  await test.step('launch replay via the anon script and pause at the breakpoint', async () => {
    await activateEditorTab(page, `${scriptName}.apex`);
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

  await test.step('assert nested local expands and renders no [object Object]', async () => {
    const variablesView = await openVariablesView(page);
    await expandAllVariableScopes(variablesView);

    // The Contact local `c` carries the nested Account relationship.
    const nestedRow = getVariableRow(variablesView, page, 'c');
    await expect(nestedRow).toBeVisible({ timeout: 30_000 });
    // Symptom assertion: nested value must not render as [object Object]
    await expect(nestedRow).not.toContainText('[object Object]');

    // Expand twistie present (collapsible affordance)
    const twistie = nestedRow.locator('.monaco-tl-twistie');
    await expect(twistie).toBeVisible({ timeout: 10_000 });

    // Expand `c` and confirm a child property row (LastName/Account) becomes visible.
    await expandNestedVariable(page, variablesView, nestedRow, /LastName|Account/);

    // No row anywhere renders [object Object]
    await expect(variablesView.locator('.monaco-list-row', { hasText: '[object Object]' })).toHaveCount(0);
    await saveScreenshot(page, 'step.nested-variables-expanded.png');
  });

  await test.step('continue and end debug session', async () => {
    // Click editor area to dismiss search-bar hover that can cover debug toolbar and block F5
    await page.locator(`${WORKBENCH} .editor-instance .view-lines`).first().click({ force: true });
    await page.keyboard.press('Escape');
    await page.keyboard.press('F5');
    await expect(page.locator('.debug-toolbar')).not.toBeVisible({ timeout: 45_000 });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
