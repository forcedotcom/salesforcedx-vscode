/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Spike (ADR 0022, W-23898526): the FIRST live apex-replay DAP session driven through code-server.
 * The gating unknown for porting the interactive-debug specs is whether a real replay session — a
 * local Node adapter (`type: apex-replay`) replaying a debug log — launches and renders the debug UI
 * (`.debug-toolbar`, `.debug-call-stack`, `.debug-variables`) in the container's browser-served
 * workbench, then continues/stops cleanly. This ports the SIMPLEST launch path from
 * debugAnonymousApex.desktop (Launch Apex Replay Debugger with Selected File on a `.apex` script),
 * adapted to the boot (default target) org — no per-test org creation, no trace flag (the anonymous
 * debug delegate produces the log inline). Hardened for the shared, persistent workbench: a unique
 * per-run script name, beforeEach reset, and a guaranteed debug-session teardown in afterEach so a
 * leaked session can't poison the next test.
 */

import { expect } from '@playwright/test';
import {
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  createAndOpenApexScript,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  openFileByName,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  WORKBENCH
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';
import { continueDebugSession } from '../../helpers/debugHelpers';

const DEBUG_TOOLBAR = '.debug-toolbar';

// Shared, persistent workbench: reset editors and notifications before each test rather than
// assuming a clean slate. No org setup — every test uses the container's boot (default) org.
test.beforeEach(async ({ page }) => {
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

// Guaranteed debug-session teardown: a session left running would poison the next test in the shared
// workbench. If the toolbar is still up (a mid-test failure never reached the clean stop), stop the
// session and wait for it to disappear. Best-effort — never fail teardown itself.
test.afterEach(async ({ page }) => {
  const toolbar = page.locator(DEBUG_TOOLBAR);
  if (await toolbar.isVisible().catch(() => false)) {
    await executeCommandWithCommandPalette(page, 'Debug: Stop').catch(() => {});
    await expect(toolbar)
      .not.toBeVisible({ timeout: 30_000 })
      .catch(() => {});
  }
});

test('Apex Replay Debugger (Code Builder): launches a replay session and renders the debug view', async ({ page }) => {
  test.setTimeout(600_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Unique per-run name so the shared, persistent workbench never collides with a script left by a
  // prior run.
  const scriptName = `ReplaySpike_${Date.now().toString(36)}`;

  await test.step('create and open an anonymous apex script in the boot-org workspace', async () => {
    await ensureSecondarySideBarHidden(page);
    await createAndOpenApexScript(page, { name: scriptName, content: "System.debug('replay spike');" });
    await saveScreenshot(page, 'setup.anon-script-open.png');
  });

  await test.step('launch the replay debugger with the selected file — toolbar must appear', async () => {
    await openFileByName(page, `${scriptName}.apex`);
    await executeCommandWithCommandPalette(page, packageNls.launch_apex_replay_debugger_with_selected_file as string);
    // Replay pauses on entry: the debug toolbar appearing is the gating unknown — a live DAP session
    // driven through code-server. Long timeout covers executing the anon apex against the boot org
    // and the adapter spawning server-side.
    await expect(page.locator(DEBUG_TOOLBAR)).toBeVisible({ timeout: 60_000 });
    await saveScreenshot(page, 'step.replay-launched.png');
  });

  await test.step('the Run and Debug view renders a call stack and a variables element', async () => {
    // Launching replay does not open the Run and Debug viewlet — show it, then confirm the debug DOM
    // (client-agnostic Monaco) actually renders in the browser-served workbench.
    await executeCommandWithCommandPalette(page, 'View: Show Run and Debug');
    const callStackRow = page.locator(`${WORKBENCH} .debug-call-stack .monaco-list-row`);
    await expect(callStackRow.first()).toBeVisible({ timeout: 30_000 });

    await executeCommandWithCommandPalette(page, 'Run and Debug: Focus on Variables View');
    const variablesView = page.locator(`${WORKBENCH} .debug-variables`);
    await expect(variablesView).toBeVisible({ timeout: 30_000 });
    await saveScreenshot(page, 'step.debug-view-rendered.png');
  });

  await test.step('continue and end the debug session cleanly', async () => {
    await continueDebugSession(page);
    await saveScreenshot(page, 'step.session-ended.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
