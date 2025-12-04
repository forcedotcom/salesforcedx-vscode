/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import { OUTPUT_TAB_ROLE } from '../utils/locators';
import { executeCommandWithCommandPalette } from './commands';

const outputPanel = (page: Page) => page.locator('[id="workbench.panel.output"]');

const outputPanelViewLines = (page: Page) => outputPanel(page).locator('.monaco-editor .view-line');

const outputPanelCodeArea = (page: Page) => outputPanel(page).locator('.monaco-editor').locator('.view-lines');

/** Normalize non-breaking spaces (char 160) to regular spaces (char 32) */
const normalizeSpaces = (text: string): string => text.replaceAll('\u00A0', ' ');

const outputFocusCommand = 'Output: Focus on Output View';

/** Opens the Output panel (idempotent - safe to call if already open) */
export const ensureOutputPanelOpen = async (page: Page): Promise<void> => {
  const outputTab = page.getByRole(OUTPUT_TAB_ROLE.role, { name: OUTPUT_TAB_ROLE.name });
  const isVisible = await outputTab.isVisible();

  if (!isVisible) {
    // Panel is hidden, use command to show it
    await executeCommandWithCommandPalette(page, outputFocusCommand);
    await outputTab.waitFor({ state: 'visible', timeout: 5000 });
  }

  const isSelected = (await outputTab.getAttribute('aria-selected')) === 'true';
  if (!isSelected) {
    await outputTab.click();
  }
};

/** Selects a specific output channel from the dropdown */
export const selectOutputChannel = async (page: Page, channelName: string): Promise<void> => {
  const dropdown = page.getByRole('combobox').filter({ has: page.getByRole('option', { name: channelName }) });
  await dropdown.selectOption({ label: channelName });
};

/** Checks if the output channel contains specific text using the filter input */
export const outputChannelContains = async (page: Page, searchText: string): Promise<boolean> => {
  const filterInput = page.getByPlaceholder(/Filter/i);
  await filterInput.fill(searchText);
  await page.waitForTimeout(500);

  try {
    // After filtering, check if matching content appears in visible .view-line elements
    const allText = await outputPanelViewLines(page).allTextContents();
    const combinedText = normalizeSpaces(allText.join(' '));

    const found = combinedText.includes(searchText);
    // Debug screenshot
    const safeName = searchText.replaceAll(/[^a-zA-Z0-9]/g, '_');
    await page.screenshot({ path: `test-results/filter-${safeName}.png` });

    return found;
  } finally {
    await filterInput.fill('');
  }
};

/** Clears the output channel by clicking the clear button in the output panel toolbar */
export const clearOutputChannel = async (page: Page): Promise<void> => {
  // The clear button is in the output panel's action bar - use first() to avoid Terminal's clear button
  const clearButton = page.getByRole('button', { name: 'Clear Output' }).first();
  await clearButton.click();

  // Wait for the output code area to be cleared
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

  // First wait for output panel to have some content
  const codeArea = outputPanelCodeArea(page);
  await expect(async () => {
    const text = await codeArea.textContent();
    expect(text?.trim().length ?? 0).toBeGreaterThan(10);
  }).toPass({ timeout: 5000 });

  const filterInput = page.getByPlaceholder(/Filter/i);

  await filterInput.fill(expectedText);

  // Wait for the text to appear in visible .view-line elements (filter scrolls to match)
  const viewLines = outputPanelViewLines(page);
  await expect(async () => {
    const allText = await viewLines.allTextContents();
    const combinedText = normalizeSpaces(allText.join(' '));
    expect(combinedText.includes(expectedText), `Expected "${expectedText}" in output`).toBe(true);
  }).toPass({ timeout });

  await filterInput.fill('');
};
