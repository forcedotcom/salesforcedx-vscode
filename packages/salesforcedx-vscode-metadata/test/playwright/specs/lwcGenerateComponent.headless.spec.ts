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
  createMinimalOrg,
  upsertScratchOrgAuthFieldsToSettings,
  executeCommandWithCommandPalette,
  validateNoCriticalErrors,
  saveScreenshot,
  QUICK_INPUT_WIDGET,
  QUICK_INPUT_LIST_ROW,
  EDITOR_WITH_URI,
  assertWelcomeTabExists,
  ensureSecondarySideBarHidden
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import packageNls from '../../../package.nls.json';

test('LWC Generate Component: creates new LWC via command palette', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let componentName: string;
  let statusBarPage: SourceTrackingStatusBarPage;

  await test.step('setup minimal org', async () => {
    const createResult = await createMinimalOrg();
    await waitForVSCodeWorkbench(page);
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'setup.after-workbench.png');
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    await saveScreenshot(page, 'setup.after-auth-fields.png');

    statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);
    await saveScreenshot(page, 'setup.after-status-bar-visible.png');
    await saveScreenshot(page, 'setup.complete.png');
  });

  await test.step('create LWC via command palette', async () => {
    componentName = `GenerateLwcTest${Date.now()}`;

    await executeCommandWithCommandPalette(page, packageNls.lightning_generate_lwc_text);
    await saveScreenshot(page, 'step1.after-command.png');

    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await quickInput
      .getByText(/Enter Lightning Web Component name/i)
      .waitFor({ state: 'visible', timeout: 10_000 });
    await saveScreenshot(page, 'step1.name-prompt-visible.png');

    await page.keyboard.type(componentName);
    await saveScreenshot(page, 'step1.after-type-name.png');
    await page.keyboard.press('Enter');

    await page.locator(QUICK_INPUT_LIST_ROW).first().waitFor({ state: 'visible', timeout: 5000 });
    await saveScreenshot(page, 'step1.directory-prompt-visible.png');

    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step1.after-accept-directory.png');

    await page.locator(EDITOR_WITH_URI).first().waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'step1.editor-opened.png');
  });

  await test.step('verify component was created correctly', async () => {
    const editorTab = page
      .locator('[role="tab"]')
      .filter({ hasText: new RegExp(`${componentName}\\.js`, 'i') });
    await expect(editorTab).toBeVisible();
    await saveScreenshot(page, 'step2.tab-visible.png');

    const explorerFolder = page
      .locator('[role="treeitem"]')
      .filter({ hasText: new RegExp(`${componentName}$`, 'i') })
      .first();
    await expect(explorerFolder).toBeVisible();
    await saveScreenshot(page, 'step2.folder-in-explorer.png');

    const editorContent = page.locator(`[data-uri*="${componentName}.js"]`).first();
    await expect(editorContent).toBeVisible();

    const editorText = page.locator('.view-lines').first();
    await expect(editorText).toContainText('import { LightningElement }');
    await saveScreenshot(page, 'step2.component-content-verified.png');

    const counts = await statusBarPage.getCounts();
    await saveScreenshot(page, `step2.counts-local-${counts.local}-remote-${counts.remote}.png`);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
