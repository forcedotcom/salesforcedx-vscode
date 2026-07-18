/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import {
  executeCommandWithCommandPalette,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  waitForQuickInputFirstOption,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import { messages } from '../../../src/messages/i18n';
import { messages as jaMessages } from '../../../src/messages/i18n.ja';

/**
 * Shared assertion body for the JA display-language desktop/headless specs. The two host targets differ
 * only by their setup (web injects `_VSCODE_NLS_LANGUAGE`; desktop installs a language pack) and by the
 * command-title source (`package.nls.json` vs `package.nls.ja.json`), so the palette-invoke + JA-renders /
 * English-absent assertion flow lives here once instead of being duplicated across both files.
 */
export const runCreateApexClassJaPromptAssertion = async (page: Page, commandTitle: string): Promise<void> => {
  // Explicit presence assert keeps the failure legible if the JA bundle ever drops this key
  // (vs. a non-null assertion that would silently pass `undefined` into getByText).
  const jaPrompt = jaMessages.apex_class_name_prompt;
  expect(jaPrompt, 'JA bundle must define apex_class_name_prompt').toBeDefined();

  // VSIX mode + JA language pack localizes the manifest title from package.nls.ja.json.
  await verifyCommandExists(page, commandTitle, 120_000);
  await executeCommandWithCommandPalette(page, commandTitle);

  await waitForQuickInputFirstOption(page);
  await page.keyboard.press('Enter'); // accept default template

  const quickInput = page.locator(QUICK_INPUT_WIDGET);
  await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
  await saveScreenshot(page, 'step.class-name-prompt.png');

  // runtime nls.localize('apex_class_name_prompt') → JA bundle string
  await expect(
    quickInput.getByText(jaPrompt!),
    'Apex class name prompt should render the Japanese translation'
  ).toBeVisible({ timeout: 10_000 });
  // and NOT the English default
  await expect(quickInput.getByText(messages.apex_class_name_prompt)).toHaveCount(0);
  await page.keyboard.press('Escape');
};
