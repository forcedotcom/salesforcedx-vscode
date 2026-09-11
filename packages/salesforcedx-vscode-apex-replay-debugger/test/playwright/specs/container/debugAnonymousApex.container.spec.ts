/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container twin of debugAnonymousApex.desktop (ADR 0022, W-23898526). This grew out of the spike
 * that first proved a live apex-replay DAP session runs through code-server, so it keeps that
 * spike's debug-view render assertions (`.debug-toolbar`, call stack, VARIABLES) in the
 * "Launch with Selected File" case. Covers the three anonymous-apex entry points that produce a
 * replay log INLINE (the anon debug delegate runs exec-anon at Apex_code=Finest), so no trace flag
 * or per-test org setup is needed — every case uses the container's boot (default target) org:
 *   - the "Debug" code lens on a `.apex` script
 *   - "Launch Apex Replay Debugger with Selected File" on a `.apex` script (+ debug-view render)
 *   - "Debug Anonymous Apex with Editor's Selected Text"
 * Hardened for the shared, persistent workbench: a unique per-run script name, a beforeEach reset,
 * and a guaranteed debug-session teardown in afterEach so a leaked session can't poison the next test.
 */

import { expect } from '@playwright/test';
import {
  assertDebugToolbarVisible,
  clearAllNotifications,
  clickCodeLens,
  closeAllEditors,
  closeWelcomeTabs,
  continueDebugSession,
  createAndOpenApexScript,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  getCallStackRows,
  openFileByName,
  openVariablesView,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  stopDebugSession,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

const ANON_APEX_CONTENT = "System.debug('hello from anonymous apex');";

// Shared, persistent workbench: reset editors and notifications before each test rather than
// assuming a clean slate. No org setup — every test uses the container's boot (default) org.
test.beforeEach(async ({ page }) => {
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

// Guaranteed debug-session teardown: a session left running would poison the next test in the shared
// workbench. Best-effort — never fails teardown itself.
test.afterEach(async ({ page }) => {
  await stopDebugSession(page);
});

test('Debug Anonymous Apex (Code Builder): Debug code lens, Launch with Selected File, and Debug with Selected Text', async ({
  page
}) => {
  test.setTimeout(600_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Unique per-run name so the shared, persistent workbench never collides with a script left by a
  // prior run.
  const scriptName = `DebugAnon_${Date.now().toString(36)}`;

  await test.step('create and open an anonymous apex script in the boot-org workspace', async () => {
    await ensureSecondarySideBarHidden(page);
    await createAndOpenApexScript(page, { name: scriptName, content: ANON_APEX_CONTENT });
    await saveScreenshot(page, 'setup.anon-script-open.png');
  });

  // ── Case 1: "Debug" code lens ──────────────────────────────────────────────
  await test.step('click "Debug" code lens — debugger must launch and complete', async () => {
    await openFileByName(page, `${scriptName}.apex`);
    // The Apex LS renders "Execute | Debug" above .apex files; click the "Debug" link.
    // Long timeout covers Apex LS cold-start indexing before code lenses appear.
    await clickCodeLens(page, 'Debug', { timeout: 120_000 });
    await continueDebugSession(page);
    await saveScreenshot(page, 'step.debug-codelens.session-ended.png');
  });

  // ── Case 2: "Launch Apex Replay Debugger with Selected File" on .apex (+ render view) ─────
  await test.step('launch the replay debugger with the selected file — toolbar must appear', async () => {
    await openFileByName(page, `${scriptName}.apex`);
    await executeCommandWithCommandPalette(page, packageNls.launch_apex_replay_debugger_with_selected_file as string);
    // Replay pauses on entry: the debug toolbar appearing is the gating unknown — a live DAP session
    // driven through code-server. Long timeout covers executing the anon apex against the boot org
    // and the adapter spawning server-side.
    await assertDebugToolbarVisible(page);
    await saveScreenshot(page, 'step.replay-launched.png');
  });

  await test.step('the Run and Debug view renders a call stack and a variables element', async () => {
    const callStackRow = getCallStackRows(page);
    // Launching replay does not open the Run and Debug viewlet — openVariablesView shows it.
    const variablesView = await openVariablesView(page);
    await expect(callStackRow.first()).toBeVisible({ timeout: 30_000 });
    await expect(variablesView).toBeVisible({ timeout: 30_000 });
    await saveScreenshot(page, 'step.debug-view-rendered.png');
  });

  await test.step('continue and end the debug session cleanly', async () => {
    await continueDebugSession(page);
    await saveScreenshot(page, 'step.launch-selected.session-ended.png');
  });

  // ── Case 3: "Debug Anonymous Apex with Editor's Selected Text" ─────────────
  await test.step('select all text and run "Debug Anonymous Apex with Editor\'s Selected Text"', async () => {
    await openFileByName(page, `${scriptName}.apex`);

    // Select the entire file contents — keep editor focus so editorHasSelection is true.
    const editorArea = page.locator('.editor-instance .view-lines').first();
    await editorArea.click({ force: true });
    await page.keyboard.press('Control+a');

    await executeCommandWithCommandPalette(page, packageNls.apex_debug_document_text as string, undefined, {
      preserveSelection: true
    });

    await continueDebugSession(page);
    await saveScreenshot(page, 'step.debug-selection.session-ended.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
