/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  isDesktop,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';
import { runCreateApexClassJaPromptAssertion } from './displayLanguageJaShared';

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

    await test.step('run Create Apex Class, InputBox shows the Japanese prompt', () =>
      runCreateApexClassJaPromptAssertion(page, packageNls.apex_generate_class_text));

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
