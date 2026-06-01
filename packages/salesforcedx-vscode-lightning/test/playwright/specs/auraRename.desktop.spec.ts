/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test } from '../fixtures';
import { expect } from '@playwright/test';
import {
  activeQuickInputWidget,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady,
  closeWelcomeTabs,
  executeCommandWithCommandPalette,
  executeEditorContextMenuCommand,
  executeExplorerContextMenuCommand,
  validateNoCriticalErrors,
  saveScreenshot,
  QUICK_INPUT_WIDGET,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  waitForQuickInputFirstOption
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';

test.describe('Aura Rename (Desktop Only)', () => {
  test('renames an existing Aura component bundle via explorer context menu', async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);
    const oldName = `RenameAuraOld${Date.now()}`;
    const newName = `RenameAuraNew${Date.now()}`;

    await test.step('setup', async () => {
      await waitForVSCodeWorkbench(page);
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await waitForWorkspaceReady(page);
    });

    await test.step('seed bundle via SFDX: Create Aura Component', async () => {
      await executeCommandWithCommandPalette(page, packageNls.lightning_generate_aura_component_text);
      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
      await page.keyboard.type(oldName);
      await page.keyboard.press('Enter');
      await waitForQuickInputFirstOption(page);
      await page.keyboard.press('Enter');
      await page.locator(EDITOR_WITH_URI).first().waitFor({ state: 'visible', timeout: 15_000 });
      await saveScreenshot(page, 'auraRename.seeded.png');
    });

    await test.step('rename via explorer context menu', async () => {
      await executeExplorerContextMenuCommand(
        page,
        new RegExp(`^${oldName}$`),
        packageNls.rename_lightning_component_text
      );
      await activeQuickInputWidget(page).waitFor({ state: 'attached', timeout: 10_000 });
      await saveScreenshot(page, 'auraRename.menu-fired.png');
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.type(newName);
      await page.keyboard.press('Enter');
      await saveScreenshot(page, 'auraRename.entered-new-name.png');
    });

    await test.step('verify rename', async () => {
      const newFolder = page
        .locator('[role="treeitem"]')
        .filter({ hasText: new RegExp(`^${newName}$`, 'i') })
        .first();
      await expect(newFolder).toBeVisible({ timeout: 10_000 });

      const oldFolder = page.locator('[role="treeitem"]').filter({ hasText: new RegExp(`^${oldName}$`, 'i') });
      await expect(oldFolder).toHaveCount(0, { timeout: 5000 });
    });

    // Follow-up: rename again via editor context menu. The renamed bundle's main file is in the active editor.
    const finalName = `RenameAuraFinal${Date.now()}`;
    await test.step('rename again via editor context menu', async () => {
      await executeEditorContextMenuCommand(page, packageNls.rename_lightning_component_text, `${newName}.cmp`);
      await activeQuickInputWidget(page).waitFor({ state: 'attached', timeout: 10_000 });
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.type(finalName);
      await page.keyboard.press('Enter');
      await saveScreenshot(page, 'auraRename.editor-menu-fired.png');
    });

    await test.step('verify second rename', async () => {
      const finalFolder = page
        .locator('[role="treeitem"]')
        .filter({ hasText: new RegExp(`^${finalName}$`, 'i') })
        .first();
      await expect(finalFolder).toBeVisible({ timeout: 10_000 });
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  });
});
