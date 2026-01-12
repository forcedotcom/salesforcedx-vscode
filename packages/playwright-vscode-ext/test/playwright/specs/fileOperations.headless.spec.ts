/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  createFileWithContents,
  openFileByName,
  editOpenFile
} from '../../../src/utils/fileHelpers';
import {
  waitForVSCodeWorkbench,
  closeWelcomeTabs
} from '../../../src/utils/helpers';
import { EDITOR, TAB } from '../../../src/utils/locators';
import { test } from '../fixtures/index';

test.describe('File Operations', () => {
  // Skip file operations tests on web - file creation dialog behavior is unreliable in VS Code web
  // These tests work on desktop where native file dialogs are available
  test.skip(({ browserName }) => process.env.VSCODE_DESKTOP !== '1', 'File operations tests are desktop-only');
  test.beforeEach(async ({ page }) => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
  });

  test('should create file with contents', async ({ page }) => {
    const fileName = 'testFile.txt';
    const fileContent = 'Hello, World!';

    await test.step('Create new file with content', async () => {
      await createFileWithContents(page, fileName, fileContent);
    });

    await test.step('Verify file is open in editor', async () => {
      const tab = page.locator(TAB).filter({ hasText: fileName });
      await expect(tab).toBeVisible();
    });

    await test.step('Verify file content', async () => {
      const editor = page.locator(EDITOR);
      await expect(editor).toContainText(fileContent);
    });
  });

  test('should open file by name', async ({ page }) => {
    const fileName = 'openTest.txt';

    await test.step('Create file first', async () => {
      await createFileWithContents(page, fileName, 'Test content');
    });

    await test.step('Close all editors', async () => {
      await page.keyboard.press('Control+KeyK');
      await page.keyboard.press('Control+KeyW');
    });

    await test.step('Open file via Quick Open', async () => {
      await openFileByName(page, fileName);
      const tab = page.locator(TAB).filter({ hasText: fileName });
      await expect(tab).toBeVisible();
    });
  });

  test('should edit open file', async ({ page }) => {
    const fileName = 'editTest.txt';
    const initialContent = 'Initial content';
    const newContent = 'Edited content';

    await test.step('Create and open file', async () => {
      await createFileWithContents(page, fileName, initialContent);
    });

    await test.step('Edit file content', async () => {
      await editOpenFile(page, newContent);
    });

    await test.step('Verify edited content', async () => {
      const editor = page.locator(EDITOR);
      await expect(editor).toContainText(newContent);
    });
  });

  test('should save file with Ctrl+S', async ({ page }) => {
    const fileName = 'saveTest.txt';
    const content = 'Content to save';

    await test.step('Create file', async () => {
      await createFileWithContents(page, fileName, content);
    });

    await test.step('Edit file to make it dirty', async () => {
      await page.keyboard.press('Control+Home');
      await page.keyboard.type('New line\n');
    });

    await test.step('Verify file is dirty', async () => {
      const dirtyTab = page.locator(TAB).filter({ hasText: fileName }).locator('.dirty-dot');
      await expect(dirtyTab).toBeVisible();
    });

    await test.step('Save file with Ctrl+S', async () => {
      await page.keyboard.press('Control+KeyS');
    });

    await test.step('Verify file is no longer dirty', async () => {
      const dirtyTab = page.locator(TAB).filter({ hasText: fileName }).locator('.dirty-dot');
      await expect(dirtyTab).not.toBeVisible();
    });
  });
});
