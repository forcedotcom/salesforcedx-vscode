/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import { executeCommandWithCommandPalette } from '../pages/commands';
import { upsertSettings } from '../pages/settings';
import {
  closeSettingsTab,
  closeWelcomeTabs,
  dismissWelcomeOnboardingOverlayIfPresent,
  waitForVSCodeWorkbench
} from './helpers';
import { CODELENS_ITEM, WORKBENCH } from './locators';

/**
 * Opens traceFlags.json and removes all debug levels via their Remove code lenses.
 * With no debug levels present, createTraceFlagForCurrentUser will auto-create
 * ReplayDebuggerLevels instead of showing the debug level picker.
 * Safe to call when no debug levels exist — the step is a no-op in that case.
 */
export const removeAllDebugLevels = async (page: Page): Promise<void> => {
  const removeLinks = page.locator(CODELENS_ITEM).filter({ hasText: /^Remove$/ });

  await expect(async () => {
    await executeCommandWithCommandPalette(page, 'SFDX: Open Trace Flags');
    await expect(page.locator('.tab').filter({ hasText: /traceFlags\.json/ })).toBeVisible({ timeout: 10_000 });
    // Wait for code lenses to render (attached is sufficient — they may be off-screen in web).
    await expect(page.locator(CODELENS_ITEM).filter({ hasText: /Create Debug level/ })).toBeAttached({
      timeout: 10_000
    });

    // This is only called when no trace flags are active, so all Remove lenses belong to
    // debug levels — click the first one and re-iterate until none remain.
    const link = removeLinks.first();
    if (!(await link.isVisible({ timeout: 1000 }).catch(() => false))) return;
    await link.scrollIntoViewIfNeeded();
    const count = await removeLinks.count();
    await link.click();
    await expect(removeLinks).not.toHaveCount(count, { timeout: 10_000 });
    throw new Error('removed one debug level, checking for more');
  }).toPass({ timeout: 60_000 });
};

/**
 * Disable Monaco editor auto-closing features (brackets, quotes, etc.) to prevent duplicates during typing.
 * Uses VS Code settings API for cleaner, more maintainable approach.
 */
export const disableMonacoAutoClosing = async (page: Page): Promise<void> => {
  await upsertSettings(page, {
    'editor.autoClosingBrackets': 'never',
    'editor.autoClosingQuotes': 'never',
    'editor.autoClosingOvertype': 'never'
  });

  // Close Settings tab so it doesn't interfere with subsequent operations
  await closeSettingsTab(page);
};

/**
 * Wait for all VS Code extensions to finish activating by watching the
 * "Developer: Show Running Extensions" editor.  More reliable than polling
 * the command palette, especially on slow CI runners (e.g. Windows).
 *
 * While an extension is activating its row contains the text "Activating".
 * Once done the row shows "Activation: Xms" / "Startup Activation: Xms".
 * We wait until no rows contain "Activating" any more.
 *
 * @param timeout - Maximum ms to wait for all extensions to activate (default 120 000).
 */
export const waitForExtensionsActivated = async (page: Page, timeout = 120_000): Promise<void> => {
  await executeCommandWithCommandPalette(page, 'Developer: Show Running Extensions');

  // The editor container gets class "runtime-extensions-editor" via createEditor()
  const editor = page.locator('.runtime-extensions-editor');
  await editor.waitFor({ state: 'visible', timeout: 15_000 });

  // Wait for the list to populate (at least one row rendered)
  const rows = editor.locator('.monaco-list-row');
  await expect(rows).not.toHaveCount(0, { timeout: 30_000 });

  // Wait until no row still contains "Activating" text
  const stillActivating = rows.filter({ hasText: 'Activating' });
  await expect(stillActivating).toHaveCount(0, { timeout });

  // Close the Running Extensions tab via command palette (cross-platform, no hover needed)
  const tab = page.getByRole('tab', { name: /Running Extensions/i });
  await executeCommandWithCommandPalette(page, 'View: Close All Editors');
  await tab.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
};

/**
 * Ensure the secondary sidebar (auxiliary bar, typically used for Chat/Copilot) is hidden.
 * This is idempotent - only hides if currently visible, avoiding toggle state issues.
 * Useful to prevent keystrokes from going to chat input instead of editor.
 */
export const ensureSecondarySideBarHidden = async (page: Page): Promise<void> => {
  // VS Code's secondary sidebar is in the .part.auxiliarybar element
  const auxiliaryBar = page.locator('.part.auxiliarybar');

  await dismissWelcomeOnboardingOverlayIfPresent(page);

  // Check if sidebar exists and is visible
  // Use a short timeout to avoid hanging if it's not there
  const isVisible = await auxiliaryBar.isVisible({ timeout: 1000 }).catch(() => false);

  if (isVisible) {
    // Focus workbench before opening palette (avoids F1/keystrokes going to auxiliary bar chat input)
    await page.locator(WORKBENCH).click({ timeout: 5000, force: true });
    // Use the explicit Hide command (not Toggle) to ensure we're hiding
    await executeCommandWithCommandPalette(page, 'View: Hide Secondary Side Bar');

    // Wait for it to actually hide
    await auxiliaryBar.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {
      // Ignore error - may have been already hidden or command not available
    });
  }
};

/**
 * Runs `Workspaces: Close Workspace` so no folder is open (empty VS Code window).
 * Call after {@link waitForVSCodeWorkbench} / {@link closeWelcomeTabs} / {@link ensureSecondarySideBarHidden} if needed.
 */
export const closeWorkspaceToEmptyWindow = async (page: Page): Promise<void> => {
  await executeCommandWithCommandPalette(page, 'Workspaces: Close Workspace');
  await waitForVSCodeWorkbench(page);
};

/**
 * From a desktop fixture that opened a workspace folder: prepare UI, then close the workspace so **no folder** is open.
 * Use when asserting palette commands with **no folder open**. Contrast: `createDesktopTest({ emptyWorkspace: true })` — a folder **is** open but has no `sfdx-project.json`.
 */
export const prepareNoFolderOpenForPaletteTests = async (page: Page): Promise<void> => {
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await closeWorkspaceToEmptyWindow(page);
  await closeWelcomeTabs(page);
};
