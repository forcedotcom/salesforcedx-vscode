/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Page } from '@playwright/test';
import { QUICK_INPUT_WIDGET, QUICK_INPUT_LIST_ROW } from '../utils/locators';

const openCommandPalette = async (page: Page): Promise<void> => {
  // Use F1 to open quick input widget (per coding-playwright-tests.mdc guidelines)
  await page.keyboard.press('F1');
  await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'visible', timeout: 3000 });

  // F1 sometimes opens Quick Open instead of Command Palette
  // Use fill() to ensure ">" prefix for command mode
  const input = page.locator(QUICK_INPUT_WIDGET).locator('input.input');
  await input.waitFor({ state: 'visible', timeout: 3000 });
  await input.fill('>');
};

const executeCommand = async (page: Page, command: string, hasNotText?: string): Promise<void> => {
  // VS Code command palette has '>' prefix from openCommandPalette
  // Get the input locator
  const input = page.locator(QUICK_INPUT_WIDGET).locator('input.input');
  await input.waitFor({ state: 'visible', timeout: 5000 });

  // Use fill() to set the full command text (including '>' prefix)
  // This is more reliable than pressSequentially() which can cause VS Code crashes
  await input.fill(`>${command}`);

  // Dispatch input event to trigger VS Code's command filtering
  // fill() doesn't trigger input events, but VS Code needs them to update the command list
  await input.dispatchEvent('input');

  // Wait for command row to appear after filling
  const commandRow = page
    .locator(QUICK_INPUT_WIDGET)
    .locator(QUICK_INPUT_LIST_ROW)
    .filter({ hasText: command, hasNotText, visible: true })
    .first();
  await commandRow.waitFor({ state: 'visible', timeout: 5000 });

  // Click the command row to execute
  await commandRow.click();
};

export const executeCommandWithCommandPalette = async (
  page: Page,
  command: string,
  hasNotText?: string
): Promise<void> => {
  await openCommandPalette(page);
  await executeCommand(page, command, hasNotText);
};
