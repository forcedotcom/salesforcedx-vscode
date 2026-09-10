/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the desktop Apex LSP restart twin (apexLspRestart.desktop.spec.ts), per ADR
 * 0022. The desktop twin proves the "SFDX: Restart Apex Language Server" command restarts jorje in
 * Electron; this proves the SAME desktop restart flow works inside the Code Builder image, where the
 * workbench is served to a browser Page but the Apex extension runs in the Node host.
 *
 * Scope note: the desktop twin's matrix also covers the "clean DB and restart" variant, which
 * removes and re-checks the workspace `.sfdx/tools/<release>/StandardApexLibrary` directory ON DISK
 * via the `workspaceDir` fixture. The container's workspace lives inside the image with no
 * `workspaceDir` handed to the browser-driven spec, so those filesystem assertions are not portable
 * — this spec covers the UI-only restart path (palette + status-bar action) and drops the clean-DB
 * disk checks. Readiness is the UI-only "Indexing complete" language-status button (the twin's
 * `waitForApexLspReady` also polled disk).
 *
 * No org setup and no file seeding: the container boots with one authed org already and
 * ExampleClass.cls already exists in the bind-mounted fixture.
 */

import { type Page } from '@playwright/test';
import {
  clearOutputChannel,
  closeWelcomeTabs,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { containerTest as test } from '../../fixtures/containerFixtures';
import { openApexFileFromExplorerTree, waitForApexLspReady } from '../../utils/containerApexLspUtils';

const APEX_LANGUAGE_SERVER_CHANNEL = 'Apex Language Server';
// `package.nls.json#apex_language_server_restart` — palette command title.
const RESTART_COMMAND = 'SFDX: Restart Apex Language Server';
// Hover-action link title (no SFDX prefix; the language status item registers the action with this label).
const RESTART_LINK_TITLE = 'Restart Apex Language Server';
const RESTART_ONLY_LABEL = 'Restart Only';
const PRELUDE_STARTING = 'Apex Prelude Service STARTING';

const getApexLanguageStatusButton = (page: Page, textRegex: RegExp) => page.getByRole('button', { name: textRegex });

/**
 * Click the Apex LSP language status button to open its hover, then click "Restart Apex Language
 * Server". Falls back to the command palette if the hover link never surfaces (VS Code may not show
 * hover-action links reliably in all CI environments).
 */
const clickApexLspRestartAction = async (page: Page): Promise<void> => {
  const statusButton = getApexLanguageStatusButton(page, /Apex/);
  const restartLink = page.getByRole('link', { name: new RegExp(RESTART_LINK_TITLE, 'i') }).first();

  // The hover popup may not appear on the first click (focus race in CI); retry up to 5 times
  // with Escape between attempts to dismiss any partially-shown or stale hover.
  let linkAppeared = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await statusButton.first().click();
    await page.waitForTimeout(300);
    await statusButton.first().hover();
    const visible = await restartLink
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (visible) {
      linkAppeared = true;
      break;
    }
  }

  if (linkAppeared) {
    await restartLink.click();
  } else {
    await page.keyboard.press('Escape');
    await executeCommandWithCommandPalette(page, RESTART_COMMAND);
  }
};

const selectRestartOnlyQuickPick = async (page: Page): Promise<void> => {
  const widget = page.locator(QUICK_INPUT_WIDGET);
  // The restart command opens this quick pick more slowly in the container (browser round-trip +
  // Node host) than in Electron, so give it more room than the desktop twin's 10s.
  await widget.waitFor({ state: 'visible', timeout: 30_000 });
  // Match the option by its exact accessible name rather than the row's full text. In the container
  // the "Restart Only" quick-pick row renders a trailing keybinding badge ("Control+K Control+C"),
  // so the desktop twin's anchored `hasText: /^Restart Only$/` row filter never matched (the row's
  // text is "Restart Only" + the keybinding) — the quick pick was open the whole time. `exact: true`
  // keeps this from also matching "Clean Apex DB and Restart".
  const option = widget.getByRole('option', { name: RESTART_ONLY_LABEL, exact: true }).first();
  await option.waitFor({ state: 'visible', timeout: 30_000 });
  await option.click();
};

/**
 * Drive a UI restart cycle: clear output → invoke restart (palette or status bar) → verify
 * intermediate "restarting" state → await Prelude STARTING → await indexing complete.
 */
const triggerLspRestart = async (page: Page, via: 'palette' | 'statusBar'): Promise<void> => {
  await ensureOutputPanelOpen(page);
  await selectOutputChannel(page, APEX_LANGUAGE_SERVER_CHANNEL);
  await clearOutputChannel(page);

  await (via === 'palette' ? executeCommandWithCommandPalette(page, RESTART_COMMAND) : clickApexLspRestartAction(page));
  await selectRestartOnlyQuickPick(page);

  // Fail-fast no-op guard. The desktop twin proves the restart command was not ignored by asserting
  // the transient "Apex Language Server is restarting" status button (toBeVisible, 10s). That
  // transient state cannot be observed reliably here: the language-status flip is pushed from the
  // Node extension host to the browser over a round-trip, so a fast restart can settle back to
  // "Indexing complete" between DOM polls and the assertion flakes (the earlier code swallowed the
  // wait with `.catch(() => {})`, so it guarded nothing). We instead guard on a DURABLE signal.
  // clearOutputChannel above asserted the Apex Language Server channel is completely EMPTY, and only
  // a real jorje (re)start prints its startup prelude into that channel. A no-op restart leaves the
  // freshly-cleared channel empty, so this wait throws ("Output channel did not have content") — the
  // same fail-fast the twin's restarting-button check gives, without the transient-state race. Then
  // waitForApexLspReady confirms the server re-reached "Indexing complete" after the fresh start.
  await waitForOutputChannelText(page, { expectedText: PRELUDE_STARTING, timeout: 60_000 });
  await waitForApexLspReady(page);
};

// Each matrix entry restarts the same shared container LSP; serial mode skips the remaining (slow)
// restart entries once one fails.
test.describe.configure({ mode: 'serial' });

const matrix = [
  { via: 'palette' as const, label: 'palette × restart only' },
  { via: 'statusBar' as const, label: 'status bar × restart only' }
];

test.describe('Apex LSP restart (Code Builder)', () => {
  test.beforeEach(async ({ page }) => {
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await openApexFileFromExplorerTree(page, 'ExampleClass.cls', ['force-app', 'main', 'default', 'classes']);
    await waitForApexLspReady(page);
  });

  for (const { via, label } of matrix) {
    test(label, async ({ page }) => {
      test.setTimeout(6 * 60 * 1000);
      const consoleErrors = setupConsoleMonitoring(page);
      const networkErrors = setupNetworkMonitoring(page);

      await triggerLspRestart(page, via);
      await saveScreenshot(page, `apexLspRestart.container.restart-${via}.png`);

      await validateNoCriticalErrors(test, consoleErrors, networkErrors);
    });
  }
});
