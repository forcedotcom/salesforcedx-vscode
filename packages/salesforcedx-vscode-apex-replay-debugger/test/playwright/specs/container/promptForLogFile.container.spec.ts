/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container twin of promptForLogFile.desktop (ADR 0022, W-23898526). Proves an apex-replay launch
 * config activates the extension and prompts for a log file in the Code Builder image. There is no
 * host workspaceDir to write a launch.json to, so an INERT config is seeded into the version-
 * controlled fixture at container-workspace/.vscode/launch.json (mounted at the boot workspace root).
 * Pressing F5 runs that config, whose `logFile: ${command:AskForLogFileName}` opens the log-file
 * quick-input picker — the assertion. Nothing is selected (Escape dismisses it), so no debug session
 * starts. Hardened for the shared, persistent workbench: a beforeEach reset.
 */

import { expect } from '@playwright/test';
import {
  QUICK_INPUT_WIDGET,
  resetContainerWorkbench,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';

import { containerTest as test } from '../../fixtures/containerFixtures';

test.beforeEach(async ({ page }) => {
  await resetContainerWorkbench(page);
});

test('Apex Replay launch (Code Builder): activates the extension and prompts for a log file', async ({ page }) => {
  test.setTimeout(120_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('press F5 to run the seeded apex-replay launch config', async () => {
    // The fixture ships .vscode/launch.json with a single apex-replay config, so F5 runs it without
    // a config picker. Its ${command:AskForLogFileName} then opens the log-file quick-input.
    await page.keyboard.press('F5');
  });

  await test.step('the log-file quick-input picker appears', async () => {
    const filePicker = page.locator(QUICK_INPUT_WIDGET);
    await expect(filePicker).toBeVisible({ timeout: 30_000 });
    await saveScreenshot(page, 'step.log-file-picker.png');
    // Dismiss so no session starts and the shared workbench is left clean.
    await page.keyboard.press('Escape');
    await expect(filePicker).not.toBeVisible({ timeout: 15_000 });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
