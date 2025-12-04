/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import { EDITOR } from '../utils/locators';
import { executeCommandWithCommandPalette } from './commands';

const OUTPUT_PANEL_ID = '[id="workbench.panel.output"]';
const outputPanel = (page: Page) => page.locator(OUTPUT_PANEL_ID);
const outputPanelViewLines = (page: Page) => outputPanel(page).locator(`${EDITOR} .view-line`);
const outputPanelCodeArea = (page: Page) => outputPanel(page).locator(`${EDITOR} .view-lines`);
const filterInput = (page: Page) => page.getByPlaceholder(/Filter/i);

/** Get combined text from visible view lines, normalized */
const getVisibleOutputText = async (page: Page): Promise<string> =>
  // Normalize non-breaking spaces (char 160) to regular spaces (char 32)
  (await outputPanelViewLines(page).allTextContents()).join(' ').replaceAll('\u00A0', ' ');

/** Use filter to search and check for text, clearing filter afterward */
const withOutputFilter = async <T>(page: Page, searchText: string, fn: () => Promise<T>): Promise<T> => {
  const input = filterInput(page);
  await input.fill(searchText);
  await page.waitForTimeout(500);
  try {
    return await fn();
  } finally {
    await input.fill('');
  }
};

const outputFocusCommand = 'Output: Focus on Output View';

/** Opens the Output panel (idempotent - safe to call if already open) */
export const ensureOutputPanelOpen = async (page: Page): Promise<void> => {
  const panel = outputPanel(page);
  const isVisible = await panel.isVisible();

  if (!isVisible) {
    await executeCommandWithCommandPalette(page, outputFocusCommand);
    await panel.waitFor({ state: 'visible', timeout: 5000 });
  }
};

/** Selects a specific output channel from the dropdown */
export const selectOutputChannel = async (page: Page, channelName: string): Promise<void> => {
  await page
    .getByRole('combobox')
    .filter({ has: page.getByRole('option', { name: channelName }) })
    .selectOption({ label: channelName });
};

/** Checks if the output channel contains specific text using the filter input */
export const outputChannelContains = async (page: Page, searchText: string): Promise<boolean> =>
  withOutputFilter(page, searchText, async () => {
    const combinedText = await getVisibleOutputText(page);
    const found = combinedText.includes(searchText);
    const safeName = searchText.replaceAll(/[^a-zA-Z0-9]/g, '_');
    await page.screenshot({ path: `test-results/filter-${safeName}.png` });
    return found;
  });

/**
 * Clears the output channel by clicking the clear button in the output panel toolbar.
 * Use this to make sure that your assertions are not picking up text from the previous test unless you mean to
 */
export const clearOutputChannel = async (page: Page): Promise<void> => {
  const clearButton = page.getByRole('button', { name: 'Clear Output' }).first();
  await clearButton.click();

  const codeArea = outputPanelCodeArea(page);
  await expect(async () => {
    const text = await codeArea.textContent();
    expect(text?.trim().length ?? 0, 'Output channel should be cleared').toBeLessThan(50);
  }).toPass({ timeout: 1000 });
};

/** Wait for output channel to contain specific text using filter */
export const waitForOutputChannelText = async (
  page: Page,
  opts: { expectedText: string; timeout?: number }
): Promise<void> => {
  const { expectedText, timeout = 30_000 } = opts;

  const codeArea = outputPanelCodeArea(page);
  await expect(async () => {
    const text = await codeArea.textContent();
    expect(text?.trim().length ?? 0).toBeGreaterThan(10);
  }).toPass({ timeout });

  await withOutputFilter(page, expectedText, async () => {
    await expect(async () => {
      const combinedText = await getVisibleOutputText(page);
      expect(combinedText.includes(expectedText), `Expected "${expectedText}" in output`).toBe(true);
    }).toPass({ timeout });
  });
};
