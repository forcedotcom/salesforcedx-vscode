/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import {
  clearOutputChannel,
  ensureOutputPanelOpen,
  executeCommandWithCommandPalette,
  QUICK_INPUT_LIST_ROW,
  QUICK_INPUT_WIDGET,
  selectOutputChannel,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { existsSync, readdirSync } from 'node:fs';
import * as path from 'node:path';

const APEX_LANGUAGE_SERVER_CHANNEL = 'Apex Language Server';
// `package.nls.json#apex_language_server_restart` — palette command title.
const RESTART_COMMAND = 'SFDX: Restart Apex Language Server';
// Hover-action link title (no SFDX prefix; the language status item registers the action with this label).
const RESTART_LINK_TITLE = 'Restart Apex Language Server';
const RESTART_ONLY_LABEL = 'Restart Only';
const CLEAN_AND_RESTART_LABEL = 'Clean Apex DB and Restart';
const STANDARD_APEX_LIBRARY = 'StandardApexLibrary';
const PRELUDE_STARTING = 'Apex Prelude Service STARTING';

/**
 * Locate the `<release>` directory under `.sfdx/tools/` (e.g. `254`, `262`). The Apex LSP creates
 * one such directory at the API version it was built against. Drops the WDIO `'254'` fallback
 * because a missing dir means the LSP never finished startup — failing fast surfaces that.
 */
export const findReleaseDir = (workspaceDir: string): string => {
  const toolsDir = path.join(workspaceDir, '.sfdx', 'tools');
  if (!existsSync(toolsDir)) {
    throw new Error(`Apex LSP tools dir not found: ${toolsDir}`);
  }
  const match = readdirSync(toolsDir).find(entry => /^\d{3}$/.test(entry));
  if (!match) {
    throw new Error(`No release dir matching /^\\d{3}$/ found in ${toolsDir}`);
  }
  return match;
};

/**
 * The Apex LSP language status button. Created via `vscode.languages.createLanguageStatusItem`,
 * VS Code surfaces it as `<button role="button">` whose accessible name embeds the status text.
 * Matched the same way `apexReplayDebugger.desktop.spec.ts:99` matches the Indexing complete button.
 */
const getApexLanguageStatusButton = (page: Page, textRegex: RegExp) => page.getByRole('button', { name: textRegex });

/**
 * Wait until the Apex LSP signals indexing is complete AND the StandardApexLibrary directory
 * exists on disk. The button alone is not enough on cold starts: jorje flips status before
 * unpacking the library, and a clean-db restart is verified by the dir's re-creation.
 *
 * @returns the resolved release dir (e.g. `262`)
 */
export const waitForApexLspReady = async (page: Page, workspaceDir: string): Promise<string> => {
  await expect(getApexLanguageStatusButton(page, /Indexing complete/)).toBeVisible({ timeout: 120_000 });

  const toolsDir = path.join(workspaceDir, '.sfdx', 'tools');
  let resolvedReleaseDir = '';
  await expect(() => {
    resolvedReleaseDir = findReleaseDir(workspaceDir);
    const stdLibDir = path.join(toolsDir, resolvedReleaseDir, STANDARD_APEX_LIBRARY);
    expect(existsSync(stdLibDir), `Expected ${stdLibDir} to exist`).toBe(true);
  }).toPass({ timeout: 60_000 });
  return resolvedReleaseDir;
};

/**
 * Click the Apex LSP language status button to open its hover, then click "Restart Apex Language Server".
 * No command-palette fallback: the `statusBar` matrix entries must genuinely exercise the status-bar
 * path, otherwise they silently duplicate the `palette` entries.
 */
const clickApexLspRestartAction = async (page: Page): Promise<void> => {
  // Click the language status button to surface its hover popup; the hover hosts the link action.
  // Match by aria-label substring — covers "Indexing complete", restart-progress states, errors, etc.
  const statusButton = getApexLanguageStatusButton(page, /Apex/);
  const restartLink = page.getByRole('link', { name: new RegExp(RESTART_LINK_TITLE, 'i') }).first();

  // The hover popup may not appear on the first click (focus race in CI); retry up to 5 times
  // with Escape between attempts to dismiss any partially-shown or stale hover.
  await expect(async () => {
    await page.keyboard.press('Escape');
    await statusButton.first().click();
    // Also hover to trigger the tooltip on platforms where click alone doesn't surface it.
    await statusButton.first().hover();
    await expect(restartLink).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 30_000 });

  await restartLink.click();
};

const selectRestartQuickPick = async (page: Page, cleanDb: boolean): Promise<void> => {
  const widget = page.locator(QUICK_INPUT_WIDGET);
  await widget.waitFor({ state: 'visible', timeout: 10_000 });
  const label = cleanDb ? CLEAN_AND_RESTART_LABEL : RESTART_ONLY_LABEL;
  const row = widget
    .locator(QUICK_INPUT_LIST_ROW)
    .filter({ hasText: new RegExp(`^${label}$`) })
    .first();
  await row.waitFor({ state: 'visible', timeout: 10_000 });
  await row.click();
};

type TriggerLspRestartOptions = {
  cleanDb: boolean;
  via: 'palette' | 'statusBar';
};

/**
 * Drive a full restart cycle: clear output → invoke restart → verify intermediate "restarting" state →
 * await Prelude STARTING → await indexing complete + StandardApexLibrary on disk.
 *
 * The intermediate `restarting` button check (matches WDIO `verifyLspStatus(LSP_STATUS.restarting)`)
 * fails fast if the restart command was ignored — important because the next two waits could
 * otherwise spuriously pass against the prior session's state.
 */
export const triggerLspRestart = async (
  page: Page,
  workspaceDir: string,
  options: TriggerLspRestartOptions
): Promise<string> => {
  await ensureOutputPanelOpen(page);
  await selectOutputChannel(page, APEX_LANGUAGE_SERVER_CHANNEL);
  await clearOutputChannel(page);

  await (options.via === 'palette'
    ? executeCommandWithCommandPalette(page, RESTART_COMMAND)
    : clickApexLspRestartAction(page));
  await selectRestartQuickPick(page, options.cleanDb);

  // Intermediate "restarting" status — fails fast if restart was ignored.
  await expect(getApexLanguageStatusButton(page, /Apex Language Server is restarting/i)).toBeVisible({
    timeout: 10_000
  });

  await waitForOutputChannelText(page, { expectedText: PRELUDE_STARTING, timeout: 60_000 });
  return waitForApexLspReady(page, workspaceDir);
};
