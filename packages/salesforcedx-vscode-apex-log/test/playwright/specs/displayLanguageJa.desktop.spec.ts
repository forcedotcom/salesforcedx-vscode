/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  isDesktop,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNlsJa from '../../../package.nls.ja.json';
import { jaDisplayLanguageTest as test } from '../fixtures';
import { runCreateApexClassJaPromptAssertion } from './displayLanguageJaShared';

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

    // VSIX mode + JA language pack localizes the manifest title from package.nls.ja.json.
    await test.step('run Create Apex Class, InputBox shows the Japanese prompt', () =>
      runCreateApexClassJaPromptAssertion(page, packageNlsJa.apex_generate_class_text));

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
