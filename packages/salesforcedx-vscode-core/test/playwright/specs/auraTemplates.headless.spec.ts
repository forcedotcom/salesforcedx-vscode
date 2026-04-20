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

test.describe('Aura Templates (Desktop Only)', () => {
  test.beforeEach(async ({ page }) => {
    setupConsoleMonitoring(page);
    setupNetworkMonitoring(page);
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
  });

  const createAuraTemplate = async (page: any, command: string, name: string, expectedFiles: string[]) => {
    await test.step(`Create Aura ${name}`, async () => {
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
      await saveScreenshot(page, `aura-${name}-created.png`);
    });
  };

  test('Create Aura App', async ({ page }) => {
    const name = `AuraApp${Date.now()}`;
    await createAuraTemplate(page, packageNls.lightning_generate_app_text, name, [
      `${name}.app`,
      `${name}.app-meta.xml`,
      `${name}Controller.js`,
      `${name}Helper.js`,
      `${name}Renderer.js`
    ]);
  });

  test('Create Aura Component', async ({ page }) => {
    const name = `AuraCmp${Date.now()}`;
    await createAuraTemplate(page, packageNls.lightning_generate_aura_component_text, name, [
      `${name}.cmp`,
      `${name}.cmp-meta.xml`,
      `${name}Controller.js`,
      `${name}Helper.js`,
      `${name}Renderer.js`
    ]);
  });

  test('Create Aura Event', async ({ page }) => {
    const name = `AuraEvent${Date.now()}`;
    await createAuraTemplate(page, packageNls.lightning_generate_event_text, name, [
      `${name}.evt`,
      `${name}.evt-meta.xml`
    ]);
  });

  test('Create Aura Interface', async ({ page }) => {
    const name = `AuraIntf${Date.now()}`;
    await createAuraTemplate(page, packageNls.lightning_generate_interface_text, name, [
      `${name}.intf`,
      `${name}.intf-meta.xml`
    ]);
  });

  test.afterEach(async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);
    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  });
});
