/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
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
import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';

test('Create Apex Unit Test Class via command palette', async ({ page }) => {
  test.setTimeout(180_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const className = `CreateTestClass${Date.now()}`;

  await test.step('setup with no org', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'setup.after-workbench.png');
  });

  await test.step('command is present', async () => {
    await verifyCommandExists(page, packageNls.apex_generate_unit_test_class_text, 120_000);
  });

  await test.step('run Create Apex Unit Test Class command', async () => {
    await executeCommandWithCommandPalette(page, packageNls.apex_generate_unit_test_class_text);
    await saveScreenshot(page, 'step.command-triggered.png');
  });

  await test.step('select template in QuickPick', async () => {
    await waitForQuickInputFirstOption(page);
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step.template-selected.png');
  });

  await test.step('enter class name in InputBox', async () => {
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
    await quickInput.getByText(messages.apex_test_class_name_prompt).waitFor({ state: 'visible', timeout: 10_000 });
    await page.keyboard.type(className);
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step.class-name-entered.png');
  });

  await test.step('select output directory in QuickPick', async () => {
    await waitForQuickInputFirstOption(page);
    await saveScreenshot(page, 'step.directory-prompt-visible.png');
    await page.keyboard.press('Enter');
    await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'hidden', timeout: 10_000 });
    await saveScreenshot(page, 'step.after-accept-directory.png');
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
