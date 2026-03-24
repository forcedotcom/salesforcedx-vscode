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
  QUICK_INPUT_LIST_ROW,
  assertWelcomeTabExists,
  ensureSecondarySideBarHidden
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';

test.describe('Analytics Templates (Desktop Only)', () => {
  test.beforeEach(async ({ page }) => {
    setupConsoleMonitoring(page);
    setupNetworkMonitoring(page);
    await waitForVSCodeWorkbench(page);
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
  });

  test('Create Sample Analytics Template', async ({ page }) => {
    const name = `Analytics${Date.now()}`;
    await test.step(`Create Analytics Template ${name}`, async () => {
      await verifyCommandExists(page, packageNls.analytics_generate_template_text, 30_000);
      await executeCommandWithCommandPalette(page, packageNls.analytics_generate_template_text);
      
      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
      await page.keyboard.type(name);
      await page.keyboard.press('Enter');

      await page.locator(QUICK_INPUT_LIST_ROW).first().waitFor({ state: 'visible', timeout: 5000 });
      await page.keyboard.press('Enter');

      // Analytics template creates multiple files, check a few key ones in explorer
      const expectedFiles = [
        'app-to-template-rules.json',
        'folder.json',
        'releaseNotes.html',
        'template-info.json',
        'template-to-app-rules.json',
        'ui.json',
        'variables.json'
      ];

      for (const file of expectedFiles) {
        const explorerFile = page.locator('[role="treeitem"]').filter({ hasText: new RegExp(`${file}$`, 'i') });
        await expect(explorerFile).toBeVisible({ timeout: 15_000 });
      }
      await saveScreenshot(page, `analytics-${name}-created.png`);
    });
  });

  test.afterEach(async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);
    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  });
});
