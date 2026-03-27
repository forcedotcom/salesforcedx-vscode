/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  createMinimalOrg,
  assertWelcomeTabExists,
  closeWelcomeTabs,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  QUICK_INPUT_LIST_ROW,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  upsertScratchOrgAuthFieldsToSettings,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';

test('Apex Generate Class: creates new Apex class via command palette', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const className = `GenerateClassTest${Date.now()}`;

  await test.step('setup minimal org', async () => {
    const createResult = await createMinimalOrg();
    await waitForVSCodeWorkbench(page);
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
    await saveScreenshot(page, 'setup.after-workbench.png');
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    await saveScreenshot(page, 'setup.after-auth-fields.png');
  });

  await test.step('command is present', async () => {
    await verifyCommandExists(page, packageNls.apex_generate_class_text, 120_000);
  });

  await test.step('create apex class via command palette', async () => {
    await executeCommandWithCommandPalette(page, packageNls.apex_generate_class_text);
    await saveScreenshot(page, 'step1.after-command.png');

    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await page.locator(QUICK_INPUT_LIST_ROW).first().waitFor({ state: 'visible', timeout: 5000 });
    await saveScreenshot(page, 'step1.template-prompt-visible.png');
    await page.keyboard.press('Enter');

    await quickInput.getByText(/Enter Apex class name/i).waitFor({ state: 'visible', timeout: 10_000 });
    await saveScreenshot(page, 'step1.name-prompt-visible.png');
    await page.keyboard.type(className);
    await saveScreenshot(page, 'step1.after-type-name.png');
    await page.keyboard.press('Enter');

    await page.locator(QUICK_INPUT_LIST_ROW).first().waitFor({ state: 'visible', timeout: 5000 });
    await saveScreenshot(page, 'step1.directory-prompt-visible.png');
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step1.after-accept-directory.png');

    await page.locator(EDITOR_WITH_URI).first().waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'step1.editor-opened.png');
  });

  await test.step('verify file was created correctly', async () => {
    const editorTab = page.locator('[role="tab"]').filter({ hasText: new RegExp(`${className}\\.cls`, 'i') });
    await expect(editorTab).toBeVisible();
    await saveScreenshot(page, 'step2.tab-visible.png');

    const explorerFile = page.locator('[role="treeitem"]').filter({ hasText: new RegExp(`${className}\\.cls$`, 'i') });
    await expect(explorerFile).toBeVisible();
    await saveScreenshot(page, 'step2.file-in-explorer.png');

    const editorContent = page.locator('[data-uri*=".cls"]').first();
    await expect(editorContent).toBeVisible();

    const editorText = page.locator('.view-lines').first();
    await expect(editorText).toContainText(`public with sharing class ${className}`);
    await saveScreenshot(page, 'step2.class-content-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
