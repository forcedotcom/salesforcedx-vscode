/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * "SFDX: Stop Apex Debugger Session" against a real org.
 *
 * Branch (a) — no active ApexDebuggerSession — is exercised here end-to-end: a fresh minimal scratch org
 * has no active session, so the command must report `debugger_stop_none_found_text`.
 *
 * Branch (b) — a single '07a' session detached via the tooling update — requires an ACTIVE ApexDebuggerSession
 * record, which only exists while an Apex Debugger session (an ISV-licensed / Debug-Only-licensed capability)
 * is live. Seeding one in CI is infeasible, so branch (b) is covered by the ConnectionService-seam unit test
 * (`test/jest/commands/debuggerStop.test.ts`, "detaches the session when the query returns a single
 * 07a-prefixed record") rather than here.
 */

import {
  closeWelcomeTabs,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';
import { debuggerDesktopTest as test } from '../fixtures';
import packageNls from '../../../package.nls.json';
import { messages } from '../../../src/messages/i18n';

const DEBUGGER_CHANNEL = 'Apex Interactive Debugger';

test('Stop Apex Debugger Session: reports none found when no active session exists', async ({ page }) => {
  test.setTimeout(60_000);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('wait for workbench', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
    await saveScreenshot(page, 'debuggerStop.01-ready.png');
  });

  await test.step('verify command exists and run it', async () => {
    await verifyCommandExists(page, packageNls.debugger_stop_text, 30_000);
    await executeCommandWithCommandPalette(page, packageNls.debugger_stop_text);
  });

  await test.step('verify output channel reports the query then no session found', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, DEBUGGER_CHANNEL, 10_000);
    await waitForOutputChannelText(page, { expectedText: messages.debugger_query_session_text, timeout: 10_000 });
    await saveScreenshot(page, 'debuggerStop.02-output-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
