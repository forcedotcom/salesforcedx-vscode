/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test } from '../fixtures';
import { expect } from '@playwright/test';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  executeCommandWithCommandPalette,
  validateNoCriticalErrors,
  saveScreenshot,
  QUICK_INPUT_WIDGET,
  QUICK_INPUT_LIST_ROW,
  EDITOR_WITH_URI,
  assertWelcomeTabExists,
  ensureSecondarySideBarHidden,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';

test('LWC Generate Component: creates new LWC via command palette', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let componentName: string;

  await test.step('setup with no org', async () => {
    await waitForVSCodeWorkbench(page);
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'setup.after-workbench.png');
  });

  await test.step('command is present', async () => {
    await verifyCommandExists(page, packageNls.lightning_generate_lwc_text, 120_000);
  });

  await test.step('create LWC via command palette', async () => {
    componentName = `GenerateLwcTest${Date.now()}`;

    await executeCommandWithCommandPalette(page, packageNls.lightning_generate_lwc_text);
    await saveScreenshot(page, 'step1.after-command.png');

    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 2000 });
    await quickInput.getByText(/Enter Lightning Web Component name/i).waitFor({ state: 'visible', timeout: 10_000 });
    await saveScreenshot(page, 'step1.name-prompt-visible.png');

    await page.keyboard.type(componentName);
    await saveScreenshot(page, 'step1.after-type-name.png');
    await page.keyboard.press('Enter');

    await page.locator(QUICK_INPUT_LIST_ROW).first().waitFor({ state: 'visible', timeout: 5000 });
    await saveScreenshot(page, 'step1.directory-prompt-visible.png');

    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step1.after-accept-directory.png');

    await page.locator(EDITOR_WITH_URI).first().waitFor({ state: 'visible', timeout: 5000 });
    await saveScreenshot(page, 'step1.editor-opened.png');
  });

  await test.step('verify component was created correctly', async () => {
    // @salesforce/templates uses camelCase for LWC dir and filename
    const camelCaseName = `${componentName.substring(0, 1).toLowerCase()}${componentName.substring(1)}`;
    const editorTab = page.locator('[role="tab"]').filter({ hasText: new RegExp(`${camelCaseName}\\.js`, 'i') });
    await expect(editorTab).toBeVisible({ timeout: 1000 });
    await saveScreenshot(page, 'step2.tab-visible.png');

    const explorerFolder = page
      .locator('[role="treeitem"]')
      .filter({ hasText: new RegExp(`${camelCaseName}$`, 'i') })
      .first();
    await expect(explorerFolder).toBeVisible({ timeout: 100 });
    await saveScreenshot(page, 'step2.folder-in-explorer.png');

    const editorContent = page.locator(`[data-uri*="${camelCaseName}.js"]`).first();
    await expect(editorContent).toBeVisible({ timeout: 100 });

    const editorText = page.locator('.view-lines').first();
    await expect(editorText).toContainText('import { LightningElement }', { timeout: 100 });
    await saveScreenshot(page, 'step2.component-content-verified.png');

    // Explorer: folder auto-expanded when .js opened. Same on web and desktop.
    await expect(page.getByRole('treeitem', { name: new RegExp(`${camelCaseName}\\.html$`, 'i') })).toBeVisible({ timeout: 2000 });
    await expect(page.getByRole('treeitem', { name: new RegExp(`${camelCaseName}\\.js-meta\\.xml$`, 'i') })).toBeVisible({ timeout: 2000 });
    await expect(page.getByRole('treeitem', { name: '__tests__' })).toBeVisible({ timeout: 2000 });
    await saveScreenshot(page, 'step2.all-files-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
