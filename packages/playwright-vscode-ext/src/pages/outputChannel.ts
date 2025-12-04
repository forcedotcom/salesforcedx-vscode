/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import { OUTPUT_TAB_ROLE } from '../utils/locators';
import { executeCommandWithCommandPalette } from './commands';

const filteredOutputLocator = (page: Page) => page.locator('.findMatchInline');

const outputPanelCodeArea = (page: Page) =>
  page.locator('[id="workbench.panel.output"]').locator('.monaco-editor').locator('.view-lines');
/** Opens the Output panel (idempotent - safe to call if already open) */
export const ensureOutputPanelOpen = async (page: Page): Promise<void> => {
  const outputTab = page.getByRole(OUTPUT_TAB_ROLE.role, { name: OUTPUT_TAB_ROLE.name });
  const isVisible = await outputTab.isVisible();

  if (!isVisible) {
    // Panel is hidden, use command to show it
    await executeCommandWithCommandPalette(page, 'View: Show Output');
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

/** Checks if the output channel contains specific text using the filter box */
export const outputChannelContains = async (page: Page, searchText: string): Promise<boolean> => {
  const filterInput = page.getByPlaceholder(/Filter/i);
  await filterInput.fill(searchText);

  // Filter highlights matching text with findMatchInline class
  // Note: highlights may be split across multiple spans (one per word)
  const matchHighlight = filteredOutputLocator(page);

  try {
    // If the filter shows highlights, it found the search text
    await expect(matchHighlight.first()).toBeVisible({ timeout: 1000 });

    // Verify the combined highlighted text contains the search string
    const allHighlights = await matchHighlight.allTextContents();
    const withSpaces = allHighlights.join(' ');
    const withoutSpaces = allHighlights.join('');

    // Normalize non-breaking spaces (char code 160) to regular spaces (char code 32)
    const normalizeSpaces = (str: string) => str.replace(/\u00A0/g, ' ');
    const normalizedHighlight = normalizeSpaces(withSpaces);
    const normalizedSearch = normalizeSpaces(searchText);

    return normalizedHighlight.includes(normalizedSearch) || withoutSpaces.includes(searchText);
  } catch {
    return false;
  } finally {
    await filterInput.fill('');
  }
};

/** Clears the output channel */
export const clearOutputChannel = async (page: Page): Promise<void> => {
  const clearButton = page.getByRole('button', { name: 'Clear Output' });
  await clearButton.click();

  // Wait for the output code area to be cleared
  const codeArea = outputPanelCodeArea(page);
  await expect(async () => {
    const text = await codeArea.textContent();
    expect(text?.trim().length ?? 0).toBeLessThan(50);
  }).toPass({ timeout: 3000 });
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
    console.log(`[waitForOutputChannelText] Current output length: ${text?.length ?? 0}`);
    expect(text?.trim().length ?? 0).toBeGreaterThan(10);
  }).toPass({ timeout: 5000 });

  const filterInput = page.getByPlaceholder(/Filter/i);

  console.log(`[waitForOutputChannelText] Searching for: "${expectedText}"`);
  await filterInput.fill(expectedText);

  console.log(`[waitForOutputChannelText] Filter value: "${await filterInput.inputValue()}"`);

  // Filter highlights matching text with findMatchInline class
  // Note: highlights may be split across multiple spans (one per word)
  const matchHighlight = filteredOutputLocator(page);

  // Wait for any highlight to appear (indicates filter found a match)
  await expect(matchHighlight.first()).toBeVisible({ timeout });

  await filterInput.fill('');
};
