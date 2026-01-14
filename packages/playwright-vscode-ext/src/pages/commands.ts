/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Page } from '@playwright/test';
import { isWindowsDesktop, typingSpeed } from '../utils/helpers';
import { QUICK_INPUT_WIDGET, QUICK_INPUT_LIST_ROW } from '../utils/locators';

export const openCommandPalette = async (page: Page): Promise<void> => {
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
  // VS Code command palette automatically adds '>' prefix when opened with F1/Ctrl+Shift+P
  const input = page.locator(QUICK_INPUT_WIDGET).locator('input.input');
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.pressSequentially(command, { delay: typingSpeed });

  // Use text content matching to find exact command (bypasses MRU prioritization)
  const commandRow = page
    .locator(QUICK_INPUT_WIDGET)
    .locator(QUICK_INPUT_LIST_ROW)
    .filter({ hasText: command, hasNotText })
    .first();

  // Ensure the row is visible and actionable before clicking
  await commandRow.waitFor({ state: 'visible', timeout: 5000 });

  // For virtualized lists, use evaluate to scroll and click (more reliable than Playwright's click)
  await commandRow.evaluate(el => {
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    (el as HTMLElement).click();
  });
};

export const executeCommandWithCommandPalette = async (
  page: Page,
  command: string,
  hasNotText?: string
): Promise<void> => {
  await openCommandPalette(page);
  await executeCommand(page, command, hasNotText);
};
