/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import { QUICK_INPUT_LIST_ROW } from '../utils/locators';
import { activeQuickInputTextField, activeQuickInputWidget } from '../utils/quickInput';
import { openCommandPalette } from './commands';

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

  await openCommandPalette(page);
  const widget = activeQuickInputWidget(page);
  const input = activeQuickInputTextField(page);
  await input.waitFor({ state: 'attached', timeout: 5000 });
  await input.click({ force: true, timeout: 5000 });
  await input.fill('>Debug Console: Focus on Debug Console View', { force: true });
  await expect(widget.locator(QUICK_INPUT_LIST_ROW).first()).toBeAttached({ timeout: 5000 });
  await page.keyboard.press('Enter');

  await expect(panel).toBeVisible({ timeout: 10_000 });
};

/** Get all visible Debug Console row text, normalized (non-breaking spaces -> regular spaces) */
const getAllDebugConsoleText = async (page: Page): Promise<string> => {
  const text = (await replRows(page).allTextContents()).join('\n');
  // Normalize non-breaking spaces (char 160) to regular spaces (char 32)
  return text.replaceAll('\u00A0', ' ');
};

/** Wait for the Debug Console (REPL) panel to contain specific text. Throws if not found within timeout. */
export const waitForDebugConsoleText = async (
  page: Page,
  opts: { expectedText: string; timeout?: number }
): Promise<void> => {
  const { expectedText, timeout = 30_000 } = opts;
  await ensureDebugConsoleOpen(page);

  await expect(async () => {
    const combinedText = await getAllDebugConsoleText(page);
    const sample = combinedText.slice(-400).trim().replaceAll('\n', ' -> ');
    expect(
      combinedText.includes(expectedText),
      `Expected "${expectedText}" in Debug Console. Last visible content: ${sample || '(empty)'}`
    ).toBe(true);
  }).toPass({ timeout });
};
