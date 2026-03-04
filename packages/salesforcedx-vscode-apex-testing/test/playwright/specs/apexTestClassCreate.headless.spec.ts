/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';

import {
  closeSettingsTab,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  EDITOR_WITH_URI,
  QUICK_INPUT_LIST_ROW,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';

test('Create Apex Unit Test Class via command palette', async ({ page }) => {
  test.setTimeout(180_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const className = `CreateTestClass${Date.now()}`;

  await test.step('setup workspace (command needs sfdx-project.json)', async () => {
    await waitForVSCodeWorkbench(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'setup.after-workbench.png');
    await setupMinimalOrgAndAuth(page);
    await ensureSecondarySideBarHidden(page);
    await closeSettingsTab(page);
    await saveScreenshot(page, 'setup.after-auth.png');
  });

  await test.step('run Create Apex Unit Test Class command', async () => {
    await verifyCommandExists(page, packageNls.apex_generate_unit_test_class_text, 30_000);
    await executeCommandWithCommandPalette(page, packageNls.apex_generate_unit_test_class_text);
    await saveScreenshot(page, 'step.command-triggered.png');
  });

  await test.step('enter class name in InputBox', async () => {
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await quickInput.getByText(/Enter Apex test class name/i).waitFor({ state: 'visible', timeout: 10_000 });
    await page.keyboard.type(className);
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step.class-name-entered.png');
  });

  await test.step('select template in QuickPick', async () => {
    await page.locator(QUICK_INPUT_LIST_ROW).first().waitFor({ state: 'visible', timeout: 5000 });
    await page.keyboard.press('Enter');
    await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'hidden', timeout: 10_000 });
    await saveScreenshot(page, 'step.template-selected.png');
  });

  await test.step('verify editor opens with new class file', async () => {
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri*="${className}.cls"]`).first();
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'step.editor-opened.png');
    const editorTab = page.locator('[role="tab"]').filter({ hasText: new RegExp(`${className}\\.cls`, 'i') });
    await expect(editorTab).toBeVisible();
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
