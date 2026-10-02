/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from '@playwright/test';
import {
  assertDebugToolbarVisible,
  clickCodeLens,
  continueDebugSession,
  createAndOpenApexScript,
  EDITOR_WITH_URI,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  focusMonacoInput,
  getCallStackRows,
  openFileByName,
  openVariablesView,
  resetContainerWorkbench,
  saveScreenshot,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  stopDebugSession,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../package.nls.json';
import { isContainer, sharedTest as test } from '../fixtures';

const ANON_APEX_CONTENT = "System.debug('hello from anonymous apex');";

// No org setup on the container's shared, persistent workbench — every test uses the boot (default)
// org, and editors/notifications are reset before each test rather than assuming a clean slate.
test.beforeEach(async ({ page }) => {
  if (isContainer) {
    await resetContainerWorkbench(page);
  }
});

// Guaranteed debug-session teardown: a session left running would poison the next test on the
// container's shared workbench. Best-effort — never fails teardown itself.
test.afterEach(async ({ page }) => {
  if (isContainer) {
    await stopDebugSession(page);
  }
});

test('Debug Anonymous Apex: Debug code lens, Launch with Selected File, and Debug with Selected Text', async ({
  page
}) => {
  test.setTimeout(600_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Unique per-run name so the container's shared, persistent workbench never collides with a script
  // left by a prior run.
  const scriptName = isContainer ? `DebugAnon_${Date.now().toString(36)}` : 'DebugAnonApex';

  await test.step('create and open a shared anonymous apex script', async () => {
    if (!isContainer) {
      await setupMinimalOrgAndAuth(page);
    }
    await ensureSecondarySideBarHidden(page);
    if (!isContainer) {
      await ensureOutputPanelOpen(page);
    }
    await createAndOpenApexScript(page, {
      name: scriptName,
      content: ANON_APEX_CONTENT
    });
    await saveScreenshot(page, 'setup.script-open.png');
  });

  // ── Case 1: "Debug" code lens ──────────────────────────────────────────────
  await test.step('click "Debug" code lens — debugger must launch and complete', async () => {
    await openFileByName(page, `${scriptName}.apex`);
    // The Apex LS renders "Execute | Debug" above .apex files; click the "Debug" link
    // Long timeout covers Apex LS cold-start indexing before code lenses appear
    await clickCodeLens(page, 'Debug', { timeout: 120_000 });
    await continueDebugSession(page);
    await saveScreenshot(page, 'step.debug-codelens.session-ended.png');
  });

  // ── Case 2: "Launch Apex Replay Debugger with Selected File" on .apex ─────
  await test.step('"Launch Apex Replay Debugger with Selected File" on .apex — debugger must launch and complete', async () => {
    await openFileByName(page, `${scriptName}.apex`);
    await executeCommandWithCommandPalette(page, packageNls.launch_apex_replay_debugger_with_selected_file as string);
    if (isContainer) {
      // This grew out of the spike that first proved a live apex-replay DAP session runs through
      // code-server, so it keeps that spike's debug-view render assertions here.
      await assertDebugToolbarVisible(page);
      const callStackRow = getCallStackRows(page);
      const variablesView = await openVariablesView(page);
      await expect(callStackRow.first()).toBeVisible({ timeout: 30_000 });
      await expect(variablesView).toBeVisible({ timeout: 30_000 });
      await saveScreenshot(page, 'step.debug-view-rendered.png');
    }
    await continueDebugSession(page);
    await saveScreenshot(page, 'step.launch-selected.session-ended.png');
  });

  // ── Case 3: "Debug Anonymous Apex with Editor's Selected Text" ─────────────
  await test.step('select all text and run "Debug Anonymous Apex with Editor\'s Selected Text"', async () => {
    await openFileByName(page, `${scriptName}.apex`);

    // Select the entire file contents — keep editor focus so editorHasSelection is true
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${scriptName}.apex"]`);
    await focusMonacoInput(editor);
    await page.keyboard.press('Control+a');

    await executeCommandWithCommandPalette(page, packageNls.apex_debug_document_text as string, undefined, {
      preserveSelection: true
    });

    await continueDebugSession(page);
    await saveScreenshot(page, 'step.debug-selection.session-ended.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
