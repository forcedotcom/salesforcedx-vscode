/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import { executeEditorContextMenuCommand } from '../../../src/pages/contextMenu';
import { createFileWithContents } from '../../../src/utils/fileHelpers';
import { waitForVSCodeWorkbench, closeWelcomeTabs, isMacDesktop } from '../../../src/utils/helpers';
import { CONTEXT_MENU, EDITOR_WITH_URI, QUICK_INPUT_WIDGET } from '../../../src/utils/locators';
import { test } from '../fixtures/index';

test.describe('Context Menu', () => {
  test.beforeEach(async ({ page }) => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
  });

  test('should execute editor context menu command', async ({ page }) => {
    test.skip(isMacDesktop(), 'Context menus not supported on Mac desktop');

    await test.step('Create and open untitled file', async () => {
      await createFileWithContents(page, 'unused', 'Test content');
    });

    await test.step('Execute Command Palette via context menu', async () => {
      const editor = page.locator(EDITOR_WITH_URI).first();
      await editor.click();

      // Execute "Command Palette..." via context menu
      await executeEditorContextMenuCommand(page, /Command Palette/);

      // Wait for Command Palette to appear
      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await expect(quickInput).toBeVisible({ timeout: 5000 });

      // Verify command palette is showing (has input box)
      const inputBox = quickInput.locator('input[type="text"]');
      await expect(inputBox).toBeVisible();

      // Close the command palette by pressing Escape
      await page.keyboard.press('Escape');
      await expect(quickInput).not.toBeVisible();
    });
  });

  test('should execute explorer context menu command', async ({ page }) => {
    test.skip(isMacDesktop(), 'Context menus not supported on Mac desktop');

    await test.step('Focus explorer', async () => {
      // Use keyboard to focus explorer
      await page.keyboard.press('Control+Shift+KeyE');
    });

    await test.step('Wait for explorer to be visible', async () => {
      const explorerView = page.locator('.explorer-folders-view');
      await expect(explorerView).toBeVisible({ timeout: 5000 });
    });

    await test.step('Execute explorer context menu command on workspace folder', async () => {
      // Use the workspace root folder for the context menu test
      // This avoids needing to create/save files
      const workspaceFolder = page.locator('.explorer-folders-view').getByRole('treeitem').first();
      await expect(workspaceFolder).toBeVisible();

      // Execute "New File..." command via context menu
      await workspaceFolder.click({ button: 'right' });

      // Wait for context menu
      const contextMenu = page.locator(CONTEXT_MENU);
      await expect(contextMenu).toBeVisible({ timeout: 2000 });

      // Find and click "New File..." option
      const newFileOption = contextMenu.getByText(/New File/i);
      await expect(newFileOption).toBeVisible();

      // Cancel by pressing Escape instead of clicking
      await page.keyboard.press('Escape');

      // Verify context menu closed
      await expect(contextMenu).not.toBeVisible();
    });
  });
});
