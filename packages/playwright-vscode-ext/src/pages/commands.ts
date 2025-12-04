/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Page } from '@playwright/test';
import { QUICK_INPUT_WIDGET } from '../utils/locators';

export const openCommandPalette = async (page: Page): Promise<void> => {
  await page.keyboard.press('F1');
  await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'visible', timeout: 3000 });
};

export const executeCommand = async (page: Page, command: string): Promise<void> => {
  await page.keyboard.type(command, { delay: 10 });
  // Use text content matching to find exact command (bypasses MRU prioritization)
  await page.locator('.monaco-list-row').filter({ hasText: command }).first().click();
};

export const executeCommandWithCommandPalette = async (page: Page, command: string): Promise<void> => {
  await openCommandPalette(page);
  await executeCommand(page, command);
};
