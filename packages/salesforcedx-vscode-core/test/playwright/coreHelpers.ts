/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Page } from '@playwright/test';
import packageNls from '../../package.nls.json';
import {
  executeCommandWithCommandPalette,
  closeSettingsTab,
  closeWelcomeTabs,
  QUICK_INPUT_WIDGET,
  QUICK_INPUT_LIST_ROW,
  EDITOR_WITH_URI
} from '@salesforce/playwright-vscode-ext';

/**
 * Creates an Apex class using the core extension's SFDX: Create Apex Class command.
 * Core uses "Enter desired filename" prompt (not "Enter Apex class name" like metadata).
 */
export const createApexClassCore = async (page: Page, className: string): Promise<void> => {
  await closeSettingsTab(page);
  await closeWelcomeTabs(page);

  await executeCommandWithCommandPalette(page, packageNls.apex_generate_class_text);

  // First prompt: "Enter desired filename" (core-specific, not "Enter Apex class name")
  const quickInput = page.locator(QUICK_INPUT_WIDGET);
  await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
  await quickInput.getByText(/Enter desired filename/i).waitFor({ state: 'visible', timeout: 10_000 });
  await page.keyboard.type(className);
  await page.keyboard.press('Enter');

  // Second prompt: Quick Pick to select output directory — accept default
  await page.locator(QUICK_INPUT_LIST_ROW).first().waitFor({ state: 'visible', timeout: 5000 });
  await page.keyboard.press('Enter');

  // Wait for editor to open with the new class
  await page.locator(EDITOR_WITH_URI).first().waitFor({ state: 'visible', timeout: 15_000 });
};
