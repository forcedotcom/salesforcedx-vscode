/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Page } from '@playwright/test';
import { isWindowsDesktop } from '../utils/helpers';
import { QUICK_INPUT_WIDGET } from '../utils/locators';

const openCommandPalette = async (page: Page): Promise<void> => {
  // Try F1 first (standard command palette shortcut)
  await page.keyboard.press('F1');
  if (isWindowsDesktop()) {
    // On Windows desktop, F1 may not work reliably, so try Ctrl+Shift+P fallback
    try {
      await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'visible', timeout: 3000 });
    } catch {
      await page.keyboard.press('Control+Shift+p');
      await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'visible', timeout: 3000 });
    }
  } else {
    // Web and macOS desktop: F1 should work
    await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'visible', timeout: 3000 });
  }
};

const executeCommand = async (page: Page, command: string, hasNotText?: string): Promise<void> => {
  await page.keyboard.type(command, { delay: 5 });
  await page.waitForTimeout(50); // unfortunately, it really does take a bit to be usable.
  // Use text content matching to find exact command (bypasses MRU prioritization)
  await page.locator('.monaco-list-row').filter({ hasText: command, hasNotText, visible: true }).first().click();
};

export const executeCommandWithCommandPalette = async (
  page: Page,
  command: string,
  hasNotText?: string
): Promise<void> => {
  await openCommandPalette(page);
  await executeCommand(page, command, hasNotText);
};
