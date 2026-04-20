/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  assertWelcomeTabExists,
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
  waitForVSCodeWorkbench,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';
import { messages } from '../../../src/messages/i18n';
import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';

test('Apex Generate Trigger: creates new Apex trigger via command palette', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const triggerName = `GenerateTriggerTest${Date.now()}`;

  await test.step('setup with no org', async () => {
    await waitForVSCodeWorkbench(page);
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
    await saveScreenshot(page, 'setup.after-workbench.png');
  });

  await test.step('command is present', async () => {
    await verifyCommandExists(page, packageNls.apex_generate_trigger_text, 120_000);
  });

  await test.step('create Apex trigger via command palette', async () => {
    await executeCommandWithCommandPalette(page, packageNls.apex_generate_trigger_text);
    await saveScreenshot(page, 'step1.after-command.png');

    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 5000 });
    await quickInput.getByText(messages.apex_trigger_name_prompt).waitFor({ state: 'visible', timeout: 10_000 });
    await saveScreenshot(page, 'step1.name-prompt-visible.png');

    await page.keyboard.type(triggerName);
    await saveScreenshot(page, 'step1.after-type-name.png');
    await page.keyboard.press('Enter');

    await waitForQuickInputFirstOption(page);
    await saveScreenshot(page, 'step1.directory-prompt-visible.png');
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step1.after-accept-directory.png');

    await page.locator(EDITOR_WITH_URI).first().waitFor({ state: 'visible', timeout: 5000 });
    await saveScreenshot(page, 'step1.editor-opened.png');
  });

  await test.step('verify trigger was created correctly', async () => {
    const editorTab = page.locator('[role="tab"]').filter({ hasText: new RegExp(`${triggerName}\\.trigger`, 'i') });
    await expect(editorTab).toBeVisible({ timeout: 1000 });
    await saveScreenshot(page, 'step2.tab-visible.png');

    const explorerTrigger = page
      .locator('[role="treeitem"]')
      .filter({ hasText: new RegExp(`${triggerName}\\.trigger$`, 'i') })
      .first();
    await expect(explorerTrigger).toBeVisible({ timeout: 2000 });
    await saveScreenshot(page, 'step2.trigger-in-explorer.png');

    await expect(
      page.getByRole('treeitem', { name: new RegExp(`${triggerName}\\.trigger-meta\\.xml$`, 'i') })
    ).toBeVisible({ timeout: 2000 });

    const editorText = page.locator('.view-lines').first();
    await expect(editorText).toContainText(`trigger ${triggerName} on SOBJECT (before insert)`, { timeout: 100 });
    await expect(editorText).toContainText('}', { timeout: 100 });
    await saveScreenshot(page, 'step2.trigger-content-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
