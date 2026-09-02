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

import { expect, type Page } from '@playwright/test';
import {
  clearOutputChannel,
  closeWelcomeTabs,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  openFileFromExplorerTree,
  QUICK_INPUT_LIST_ROW,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { containerTest as test } from '../../fixtures/containerFixtures';

const APEX_LANGUAGE_SERVER_CHANNEL = 'Apex Language Server';
// `package.nls.json#apex_language_server_restart` — palette command title.
const RESTART_COMMAND = 'SFDX: Restart Apex Language Server';
// Hover-action link title (no SFDX prefix; the language status item registers the action with this label).
const RESTART_LINK_TITLE = 'Restart Apex Language Server';
const RESTART_ONLY_LABEL = 'Restart Only';
const PRELUDE_STARTING = 'Apex Prelude Service STARTING';

const getApexLanguageStatusButton = (page: Page, textRegex: RegExp) => page.getByRole('button', { name: textRegex });

/**
 * UI-only Apex LSP readiness: wait for the "Indexing complete" language-status button. The desktop
 * twin also checks StandardApexLibrary on disk, but the container's workspace is inside the image
 * (and boots pre-indexed), so the button alone is the reliable in-browser signal.
 */
const waitForApexLspReady = async (page: Page): Promise<void> => {
  await expect(getApexLanguageStatusButton(page, /Indexing complete/)).toBeVisible({ timeout: 120_000 });
};

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
  await widget.waitFor({ state: 'visible', timeout: 10_000 });
  const row = widget
    .locator(QUICK_INPUT_LIST_ROW)
    .filter({ hasText: new RegExp(`^${RESTART_ONLY_LABEL}$`) })
    .first();
  await row.waitFor({ state: 'visible', timeout: 10_000 });
  await row.click();
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

  // Intermediate "restarting" status — fails fast if restart was ignored.
  await expect(getApexLanguageStatusButton(page, /Apex Language Server is restarting/i)).toBeVisible({
    timeout: 10_000
  });

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
    await openFileFromExplorerTree(page, 'ExampleClass.cls', ['force-app', 'main', 'default', 'classes']);
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
