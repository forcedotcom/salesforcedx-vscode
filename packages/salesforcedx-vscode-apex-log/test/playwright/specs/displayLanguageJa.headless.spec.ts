/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
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
import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';

// Web-only: proves vscode.env.language wiring. On web, env.language derives from
// globalThis._VSCODE_NLS_LANGUAGE (workbench.web.main getNLSLanguage), which @vscode/test-web never sets.
// Inject it before the workbench loads so the apex-log nls resolves JA. The workbench chrome / command
// titles stay English (test-web ships no JA language pack), so we invoke by the English command title,
// but the extension's runtime nls reads env.language independently → the input-box prompt renders JA.
// No org needed: SFDX: Create Apex Class is gated only on sf:project_opened.
(isDesktop() ? test.skip.bind(test) : test)(
  'Display language JA (web): apex-log runtime nls renders Japanese',
  async ({ page }) => {
    test.setTimeout(180_000);
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    await test.step('setup with no org, JA display language injected before workbench loads', async () => {
      await page.addInitScript(() => {
        (globalThis as unknown as { _VSCODE_NLS_LANGUAGE?: string })._VSCODE_NLS_LANGUAGE = 'ja';
      });
      await waitForVSCodeWorkbench(page);
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await saveScreenshot(page, 'setup.after-workbench.png');
    });

    await test.step('run Create Apex Class, InputBox shows the Japanese prompt', async () => {
      await verifyCommandExists(page, packageNls.apex_generate_class_text, 120_000);
      await executeCommandWithCommandPalette(page, packageNls.apex_generate_class_text);

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
