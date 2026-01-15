/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import { createFileWithContents } from '../../../src/utils/fileHelpers';
import { waitForVSCodeWorkbench, assertWelcomeTabExists, closeWelcomeTabs } from '../../../src/utils/helpers';
import { EDITOR_WITH_URI, TAB } from '../../../src/utils/locators';
import { test } from '../fixtures/index';

test.describe('File Operations', () => {
  test.beforeEach(async ({ page }) => {
    await waitForVSCodeWorkbench(page);
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
  });

  test('should create file with contents', async ({ page }) => {
    const fileName = 'test-file.txt';
    const fileContent = 'Hello, World!';

    await test.step(`Create new untitled file ${fileName} with content`, async () => {
      await createFileWithContents(page, fileName, fileContent);
    });

    await test.step('Verify untitled file is open in editor', async () => {
      const tab = page.locator(TAB).filter({ hasText: /Untitled-\d+/ });
      await expect(tab).toBeVisible();
    });

    await test.step('Verify file content', async () => {
      const editor = page.locator(EDITOR_WITH_URI).first();
      await expect(editor).toContainText(fileContent);
    });
  });

  test('should switch between multiple files', async ({ page }) => {
    const firstFile = 'first-file.txt';
    const secondFile = 'second-file.txt';

    await test.step(`Create first file ${firstFile}`, async () => {
      await createFileWithContents(page, firstFile, 'First file content');
    });

    await test.step(`Create second file ${secondFile}`, async () => {
      await createFileWithContents(page, secondFile, 'Second file content');
    });

    await test.step('Verify both tabs are visible', async () => {
      const tabs = page.locator(TAB).filter({ hasText: /Untitled-\d+/ });
      await expect(tabs).toHaveCount(2);
    });

    await test.step('Switch to first tab by clicking', async () => {
      const firstTab = page.locator(TAB).filter({ hasText: /Untitled-1/ });
      await firstTab.click();
      const editor = page.locator(EDITOR_WITH_URI).first();
      await expect(editor).toContainText('First file content');
    });

    await test.step('Switch to second tab by clicking', async () => {
      const secondTab = page.locator(TAB).filter({ hasText: /Untitled-2/ });
      await secondTab.click();
      const editor = page.locator(EDITOR_WITH_URI).first();
      await expect(editor).toContainText('Second file content');
    });
  });

  test('should edit open file', async ({ page }) => {
    const fileName = 'editable-file.txt';
    const initialContent = 'Initial content';

    await test.step(`Create and open file ${fileName}`, async () => {
      await createFileWithContents(page, fileName, initialContent);
    });

    await test.step('Edit file content by typing', async () => {
      const editor = page.locator(EDITOR_WITH_URI).first();
      await editor.click();
      await page.keyboard.press('Control+End');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Added text');
    });

    await test.step('Verify edited content', async () => {
      const editor = page.locator(EDITOR_WITH_URI).first();
      await expect(editor).toContainText(initialContent);
      await expect(editor).toContainText('Added text');
    });
  });

  test('should show dirty indicator when file has unsaved changes', async ({ page }) => {
    const fileName = 'dirty-file.txt';
    const content = 'Content to edit';

    await test.step(`Create file ${fileName}`, async () => {
      await createFileWithContents(page, fileName, content);
    });

    await test.step('Verify file shows dirty indicator (untitled files are dirty)', async () => {
      // Wait for tab to appear first
      const tab = page.locator(TAB).filter({ hasText: /Untitled-\d+/ });
      await expect(tab).toBeVisible();
      // Then check for dirty indicator
      const dirtyIndicator = page.locator('.tabs-container .tab.dirty');
      await expect(dirtyIndicator).toBeVisible();
    });

    await test.step('Edit file further', async () => {
      const editor = page.locator(EDITOR_WITH_URI).first();
      await editor.click();
      await page.keyboard.press('Control+End');
      await page.keyboard.press('Enter');
      await page.keyboard.type('More content');
    });

    await test.step('Verify file still shows dirty indicator', async () => {
      const dirtyIndicator = page.locator('.tabs-container .tab.dirty');
      await expect(dirtyIndicator).toBeVisible();
      const editor = page.locator(EDITOR_WITH_URI).first();
      await expect(editor).toContainText('More content');
    });
  });
});
