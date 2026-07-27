/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Page } from '@playwright/test';
import {
  executeCommandWithCommandPalette,
  QUICK_INPUT_WIDGET,
  selectQuickInputOptionByTyping
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../package.nls.json';

/** Run Create Apex Test Suite via command palette: type suite name, select one class, confirm. */
export const createApexTestSuiteViaPalette = async (
  page: Page,
  testSuiteName: string,
  testClassName: string
): Promise<void> => {
  await executeCommandWithCommandPalette(page, packageNls.apex_test_suite_create_text);
  const quickInput = page.locator(QUICK_INPUT_WIDGET);
  await quickInput.waitFor({ state: 'visible', timeout: 10_000 });

  // Type suite name and press Enter
  await page.keyboard.type(testSuiteName);
  await page.keyboard.press('Enter');

  // Wait for next prompt (select test classes)
  await quickInput.waitFor({ state: 'visible', timeout: 30_000 });

  // Multi-select picker: toggle the matching row checkbox, then confirm
  await selectQuickInputOptionByTyping(page, testClassName, { optionTimeout: 5000, multiSelect: true });

  // Press Enter to confirm selection
  await page.keyboard.press('Enter');
};
