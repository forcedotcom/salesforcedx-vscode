/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  clickCodeLens,
  createAndOpenApexScript,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  openFileByName,
  saveScreenshot,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';

import apexLogNls from 'salesforcedx-vscode-apex-log/package.nls.json';
import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';
import { continueDebugSession } from '../helpers/debugHelpers';

const ANON_APEX_CONTENT = "System.debug('hello from anonymous apex');";
const ANON_APEX_SCRIPT_NAME = 'DebugAnonApex';

test('Debug Anonymous Apex: Debug code lens, Launch with Selected File, and Debug with Selected Text', async ({
  page
}) => {
  test.setTimeout(600_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup minimal org and create shared anonymous apex script', async () => {
    await setupMinimalOrgAndAuth(page);
    await ensureSecondarySideBarHidden(page);
    await ensureOutputPanelOpen(page);
    await createAndOpenApexScript(page, {
      commandLabel: apexLogNls['apexLog.command.createAnonymousApexScript'] as string,
      name: ANON_APEX_SCRIPT_NAME,
      content: ANON_APEX_CONTENT
    });
    await saveScreenshot(page, 'setup.script-open.png');
  });

  // ── Case 1: "Debug" code lens ──────────────────────────────────────────────
  await test.step('click "Debug" code lens — debugger must launch and complete', async () => {
    await openFileByName(page, `${ANON_APEX_SCRIPT_NAME}.apex`);
    // The Apex LS renders "Execute | Debug" above .apex files; click the "Debug" link
    // Long timeout covers Apex LS cold-start indexing before code lenses appear
    await clickCodeLens(page, 'Debug', { timeout: 120_000 });
    await continueDebugSession(page);
    await saveScreenshot(page, 'step.debug-codelens.session-ended.png');
  });

  // ── Case 2: "Launch Apex Replay Debugger with Selected File" on .apex ─────
  await test.step('"Launch Apex Replay Debugger with Selected File" on .apex — debugger must launch and complete', async () => {
    await openFileByName(page, `${ANON_APEX_SCRIPT_NAME}.apex`);
    await executeCommandWithCommandPalette(page, packageNls.launch_apex_replay_debugger_with_selected_file as string);
    await continueDebugSession(page);
    await saveScreenshot(page, 'step.launch-selected.session-ended.png');
  });

  // ── Case 3: "Debug Anonymous Apex with Editor's Selected Text" ─────────────
  await test.step('select all text and run "Debug Anonymous Apex with Editor\'s Selected Text"', async () => {
    await openFileByName(page, `${ANON_APEX_SCRIPT_NAME}.apex`);

    // Select the entire file contents — keep editor focus so editorHasSelection is true
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
