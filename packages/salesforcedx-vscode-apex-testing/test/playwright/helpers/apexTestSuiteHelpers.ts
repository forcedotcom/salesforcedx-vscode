/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Page } from '@playwright/test';
import {
  EDITOR_WITH_URI,
  executeCommandWithCommandPalette,
  executeExplorerContextMenuCommand,
  EXPLORER_INLINE_INPUT,
  QUICK_INPUT_WIDGET,
  saveFile,
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

/** Create a suite metadata file through VS Code's workspace filesystem (disk or web memfs). */
export const createLocalApexTestSuiteFile = async (
  page: Page,
  testSuiteName: string,
  testClassName: string
): Promise<void> => {
  await executeExplorerContextMenuCommand(page, /force-app/, /New File\.\.\./);
  const input = page.locator(EXPLORER_INLINE_INPUT);
  await input.waitFor({ state: 'visible', timeout: 10_000 });
  await input.fill(`main/default/testSuites/${testSuiteName}.testSuite-meta.xml`, { force: true });
  await page.keyboard.press('Enter');

  const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${testSuiteName}.testSuite-meta.xml"]`);
  await editor.waitFor({ state: 'visible', timeout: 30_000 });
  await editor.click();
  await page.keyboard.type(
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<ApexTestSuite xmlns="http://soap.sforce.com/2006/04/metadata">',
      `    <testClassName>${testClassName}</testClassName>`,
      '</ApexTestSuite>'
    ].join('\n')
  );
  await saveFile(page);
};
