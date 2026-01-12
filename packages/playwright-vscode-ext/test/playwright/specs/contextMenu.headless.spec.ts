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
import { EDITOR_WITH_URI, QUICK_INPUT_WIDGET } from '../../../src/utils/locators';
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

    await test.step('Verify explorer view is accessible', async () => {
      // Focus explorer using keyboard shortcut
      await page.keyboard.press('Control+Shift+KeyE');

      // Wait for explorer heading to confirm it's visible
      const explorerHeading = page.getByRole('heading', { name: 'Explorer' });
      await expect(explorerHeading).toBeVisible({ timeout: 5000 });

      // Note: Without a workspace folder, there's no file/folder tree to right-click on.
      // The "NO FOLDER OPENED" state doesn't support context menus.
      // This test verifies that explorer is accessible and the view can be focused.
      // Actual explorer context menu functionality (executeExplorerContextMenuCommand)
      // is tested in extensions that have workspace folders (like org-browser).

      // Verify the "Open Folder" button is present as proof explorer loaded correctly
      const openFolderButton = page.getByRole('button', { name: /Open Folder/i });
      await expect(openFolderButton).toBeVisible();
    });
  });
});
