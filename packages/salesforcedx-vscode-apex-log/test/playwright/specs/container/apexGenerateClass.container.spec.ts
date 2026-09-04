/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for Apex class scaffolding. The web twin
 * (apexGenerateClass.headless.spec.ts) proves the command palette flow against a plain Page; this
 * proves the template scaffolding actually lands a `.cls` file in the workspace from inside the Code
 * Builder image, running the desktop extension build against the container's boot-authed org.
 */

import { expect } from '@playwright/test';
import {
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  selectQuickInputOption,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForQuickInputFirstOption
} from '@salesforce/playwright-vscode-ext';
import { messages } from '../../../../src/messages/i18n';
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

// Shared persistent workbench: reset editors + notifications between specs so scaffolding assertions
// start from a known state.
test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('Apex Generate Class (Code Builder): creates a class via command palette', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  // Unique name so repeated runs on the shared workbench never collide with a prior scaffold.
  const className = `GenerateClassTest${Date.now()}`;

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'apexGenerateClass.container.01-ready.png');
  });

  await test.step('command is present', async () => {
    await verifyCommandExists(page, packageNls.apex_generate_class_text, 120_000);
  });

  await test.step('run Apex Generate Class command', async () => {
    await executeCommandWithCommandPalette(page, packageNls.apex_generate_class_text);
    await saveScreenshot(page, 'apexGenerateClass.container.02-command-triggered.png');
  });

  await test.step('select template in QuickPick', async () => {
    await selectQuickInputOption(page, 'DefaultApexClass');
    await saveScreenshot(page, 'apexGenerateClass.container.03-template-selected.png');
  });

  await test.step('enter class name in InputBox', async () => {
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
    await quickInput.getByText(messages.apex_class_name_prompt).waitFor({ state: 'visible', timeout: 10_000 });
    await page.keyboard.type(className);
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'apexGenerateClass.container.04-class-name-entered.png');
  });

  await test.step('select output directory in QuickPick', async () => {
    await waitForQuickInputFirstOption(page);
    await saveScreenshot(page, 'apexGenerateClass.container.05-directory-prompt-visible.png');
    await page.keyboard.press('Enter');
    await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'hidden', timeout: 10_000 });
    await saveScreenshot(page, 'apexGenerateClass.container.06-after-accept-directory.png');
  });

  await test.step('verify editor opens with new class file', async () => {
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri*="${className}.cls"]`).first();
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'apexGenerateClass.container.07-editor-opened.png');
    const editorTab = page.locator('[role="tab"]').filter({ hasText: new RegExp(`${className}\\.cls`, 'i') });
    await expect(editorTab).toBeVisible();
    const explorerFile = page.locator('[role="treeitem"]').filter({ hasText: new RegExp(`${className}\\.cls$`, 'i') });
    await expect(explorerFile).toBeVisible();
    await saveScreenshot(page, 'apexGenerateClass.container.08-file-in-explorer.png');
    const editorText = page.locator('.view-lines').first();
    await expect(editorText).toContainText(`public with sharing class ${className}`);
    await saveScreenshot(page, 'apexGenerateClass.container.09-class-content-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
