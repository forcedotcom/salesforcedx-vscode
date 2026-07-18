/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  executeCommandWithCommandPalette,
  isDesktop,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForQuickInputFirstOption,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { messages } from '../../../src/messages/i18n';
import { messages as jaMessages } from '../../../src/messages/i18n.ja';
import packageNlsJa from '../../../package.nls.ja.json';
import { jaDisplayLanguageTest as test } from '../fixtures';

// Desktop-only: JA language pack + --locale=ja makes vscode.env.language === 'ja', which the apex-log
// consumer passes to createNls (param wins over VSCODE_NLS_CONFIG). Exercises the real desktop NLS
// pipeline — the automated form of the manual `--locale=ja` verification in contributing/localization.md.
// No org needed: SFDX: Create Apex Class is gated only on sf:project_opened.
(isDesktop() ? test : test.skip.bind(test))(
  'Display language JA (desktop): apex-log runtime nls renders Japanese',
  async ({ page }) => {
    test.setTimeout(180_000);
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    await test.step('setup with no org', async () => {
      // Chrome renders in Japanese under the language pack, so avoid English-named native-command
      // helpers (closeWelcomeTabs / ensureSecondarySideBarHidden) — they can't match localized titles.
      await waitForVSCodeWorkbench(page);
      await saveScreenshot(page, 'setup.after-workbench.png');
    });

    await test.step('run Create Apex Class, InputBox shows the Japanese prompt', async () => {
      // VSIX mode + JA language pack localizes the manifest title from package.nls.ja.json.
      await verifyCommandExists(page, packageNlsJa.apex_generate_class_text, 120_000);
      await executeCommandWithCommandPalette(page, packageNlsJa.apex_generate_class_text);

      await waitForQuickInputFirstOption(page);
      await page.keyboard.press('Enter'); // accept default template

      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
      await saveScreenshot(page, 'step.class-name-prompt.png');

      // runtime nls.localize('apex_class_name_prompt') → JA bundle string
      await expect(
        quickInput.getByText(jaMessages.apex_class_name_prompt!),
        'Apex class name prompt should render the Japanese translation'
      ).toBeVisible({ timeout: 10_000 });
      // and NOT the English default
      await expect(quickInput.getByText(messages.apex_class_name_prompt)).toHaveCount(0);
      await page.keyboard.press('Escape');
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
