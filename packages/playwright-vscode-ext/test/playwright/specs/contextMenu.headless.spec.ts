/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import { test } from '../fixtures/index';
import {
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  isMacDesktop
} from '../../../src/utils/helpers';
import {
  executeEditorContextMenuCommand,
  executeExplorerContextMenuCommand
} from '../../../src/pages/contextMenu';
import { createFileWithContents } from '../../../src/utils/fileHelpers';

test.describe('Context Menu', () => {
  test.beforeEach(async ({ page }) => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
  });

  test('should execute editor context menu command', async ({ page }) => {
    test.skip(isMacDesktop(), 'Context menus not supported on Mac desktop');

    const fileName = 'contextMenuTest.txt';

    await test.step('Create and open file', async () => {
      await createFileWithContents(page, fileName, 'Test content for context menu');
    });

    await test.step('Execute context menu command', async () => {
      // Select all text first
      await page.keyboard.press('Control+KeyA');

      // Execute copy via context menu
      await executeEditorContextMenuCommand(page, 'Copy');

      // Verify copy worked by pasting
      await page.keyboard.press('Control+End');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Control+KeyV');

      const editor = page.locator('.monaco-editor .view-lines');
      const content = await editor.textContent();
      expect(content).toContain('Test content for context menu');
    });
  });

  test('should execute explorer context menu command', async ({ page }) => {
    test.skip(isMacDesktop(), 'Context menus not supported on Mac desktop');

    const fileName = 'explorerTest.txt';

    await test.step('Create file', async () => {
      await createFileWithContents(page, fileName, 'Explorer context menu test');
    });

    await test.step('Close editor to access explorer', async () => {
      await page.keyboard.press('Control+KeyK');
      await page.keyboard.press('Control+KeyW');
    });

    await test.step('Focus explorer', async () => {
      // Use keyboard to focus explorer
      await page.keyboard.press('Control+Shift+KeyE');
      await page.waitForTimeout(500);
    });

    await test.step('Execute explorer context menu command', async () => {
      // Find file in explorer
      const explorerFile = page.locator('.explorer-folders-view').getByText(fileName);
      await expect(explorerFile).toBeVisible();

      // Execute rename command via context menu
      await executeExplorerContextMenuCommand(page, fileName, 'Rename');

      // Verify rename dialog appears
      const inputBox = page.locator('.monaco-inputbox input');
      await expect(inputBox).toBeVisible();
      await expect(inputBox).toHaveValue(fileName);

      // Cancel rename
      await page.keyboard.press('Escape');
    });
  });
});
