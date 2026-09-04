/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container twin of debuggerStop.headless (ADR 0022). Proves "SFDX: Stop Apex Debugger Session"
 * works in the Code Builder image against the container's boot-authed org.
 *
 * Branch (a) — no active ApexDebuggerSession — is exercised here end-to-end: the container's boot
 * scratch org has no active session, so the command must report `debugger_stop_none_found_text`.
 * This is a plain command + notification check with NO DAP / interactive debug session.
 *
 * Branch (b) — an active session detached via the tooling update — requires an ACTIVE
 * ApexDebuggerSession record, which only exists while an Apex Debugger session (an ISV-licensed /
 * Debug-Only-licensed capability) is live. Seeding one in CI is infeasible, so branch (b) is covered
 * by the ConnectionService-seam unit test (`test/jest/commands/debuggerStop.test.ts`) rather than here.
 */

import {
  clearAllNotifications,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForNotification,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';
import { containerTest as test } from '../../fixtures/containerFixtures';
import packageNls from '../../../../package.nls.json';
import { messages } from '../../../../src/messages/i18n';

test('Stop Apex Debugger Session (Code Builder): reports none found when no active session exists', async ({
  page
}) => {
  test.setTimeout(60_000);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('wait for workbench', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await clearAllNotifications(page);
    await waitForWorkspaceReady(page);
    await saveScreenshot(page, 'debuggerStop.container.01-ready.png');
  });

  await test.step('verify command exists and run it', async () => {
    await verifyCommandExists(page, packageNls.debugger_stop_text, 30_000);
    await executeCommandWithCommandPalette(page, packageNls.debugger_stop_text);
  });

  await test.step('verify the no-session-found notification appears', async () => {
    await waitForNotification(page, new RegExp(messages.debugger_stop_none_found_text), { timeout: 15_000 });
    await saveScreenshot(page, 'debuggerStop.container.02-none-found-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
