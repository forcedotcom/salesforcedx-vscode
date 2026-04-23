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
  waitForWorkspaceReady,
  verifyCommandExists,
  closeWelcomeTabs,
  executeCommandWithCommandPalette,
  validateNoCriticalErrors,
  saveScreenshot,
  QUICK_INPUT_WIDGET,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  waitForQuickInputFirstOption
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';

test.describe('Visualforce Templates (Desktop Only)', () => {
  test.beforeEach(async ({ page }) => {
    setupConsoleMonitoring(page);
    setupNetworkMonitoring(page);
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
  });

  const createVisualforceTemplate = async (page: any, command: string, name: string, expectedFiles: string[]) => {
    await test.step(`Create Visualforce ${name}`, async () => {
      await verifyCommandExists(page, command, 30_000);
      await executeCommandWithCommandPalette(page, command);

      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
      await page.keyboard.type(name);
      await page.keyboard.press('Enter');

      await waitForQuickInputFirstOption(page);
      await page.keyboard.press('Enter');

      await page.locator(EDITOR_WITH_URI).first().waitFor({ state: 'visible', timeout: 15_000 });

      for (const file of expectedFiles) {
        const explorerFile = page.locator('[role="treeitem"]').filter({ hasText: new RegExp(`${file}$`, 'i') });
        await expect(explorerFile).toBeVisible();
      }
      await saveScreenshot(page, `vf-${name}-created.png`);
    });
  };

  test('Create Visualforce Page', async ({ page }) => {
    const name = `VFPage${Date.now()}`;
    await createVisualforceTemplate(page, packageNls.visualforce_generate_page_text, name, [
      `${name}.page`,
      `${name}.page-meta.xml`
    ]);
  });

  test('Create Visualforce Component', async ({ page }) => {
    const name = `VFCmp${Date.now()}`;
    await createVisualforceTemplate(page, packageNls.visualforce_generate_component_text, name, [
      `${name}.component`,
      `${name}.component-meta.xml`
    ]);
  });

  test.afterEach(async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);
    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  });
});
