/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import { normalizeNonBreakingSpaces } from '../utils/helpers';
import { executeCommandWithCommandPalette } from './commands';

// Debug Console (REPL) is a distinct panel from the Output channel (workbench.panel.output)
const REPL_PANEL_ID = '[id="workbench.panel.repl"]';
const replPanel = (page: Page) => page.locator(REPL_PANEL_ID);
// OutputEvent lines render as .repl rows; scope to the panel to avoid matching other views
const replRows = (page: Page) => replPanel(page).locator('.monaco-list-row');

/** Opens the Debug Console (REPL) panel (idempotent - safe to call if already open) */
export const ensureDebugConsoleOpen = async (page: Page): Promise<void> => {
  const panel = replPanel(page);
  if (await panel.isVisible()) {
    return;
  }

  await executeCommandWithCommandPalette(page, 'Debug Console: Focus on Debug Console View');
  await expect(panel).toBeVisible({ timeout: 10_000 });
};

/** Get all currently-rendered Debug Console row text, normalized (non-breaking spaces -> regular spaces) */
const getAllDebugConsoleText = async (page: Page): Promise<string> =>
  normalizeNonBreakingSpaces((await replRows(page).allTextContents()).join('\n'));

/**
 * Wait for the Debug Console (REPL) panel to contain specific text. Throws if not found within timeout.
 * The REPL is a virtualized monaco-list, so only in-viewport rows exist in the DOM and the console
 * auto-scrolls to the newest line. Sweep top->bottom (bounded) so earlier lines that scrolled out of
 * the viewport are still found. Mirrors the sweep in waitForOutputChannelText.
 */
export const waitForDebugConsoleText = async (
  page: Page,
  opts: { expectedText: string; timeout?: number }
): Promise<void> => {
  const { expectedText, timeout = 30_000 } = opts;
  await ensureDebugConsoleOpen(page);

  // force: true — REPL toolbar/overlays can intercept pointer events on the list
  await replRows(page)
    .first()
    .click({ force: true })
    .catch(() => {});

  const PAGE_STEPS = 30;

  await expect(async () => {
    // Fast path: text may already be in the visible viewport
    if ((await getAllDebugConsoleText(page)).includes(expectedText)) return;

    // Sweep top -> bottom; exit as soon as text is found
    await page.keyboard.press('Control+Home');
    for (let i = 0; i < PAGE_STEPS; i++) {
      if ((await getAllDebugConsoleText(page)).includes(expectedText)) return;
      await page.keyboard.press('PageDown');
    }

    const sample = (await getAllDebugConsoleText(page)).slice(-400).trim().replaceAll('\n', ' -> ');
    throw new Error(`Expected "${expectedText}" in Debug Console. Last visible content: ${sample || '(empty)'}`);
  }).toPass({ timeout });
};
