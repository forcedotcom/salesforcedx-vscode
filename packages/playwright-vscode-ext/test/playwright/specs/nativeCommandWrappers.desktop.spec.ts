/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import { focusOnFilesExplorer, goToLineColumn, saveFile, showExplorer } from '../../../src/pages/nativeCommands';
import { openFileByName } from '../../../src/utils/fileHelpers';
import { closeWelcomeTabs, waitForVSCodeWorkbench } from '../../../src/utils/helpers';
import { EDITOR_WITH_URI, TAB } from '../../../src/utils/locators';
import { ensureSecondarySideBarHidden } from '../../../src/utils/workflows';
import { test } from '../fixtures/index';

test.describe('Desktop native command wrappers', () => {
  test.beforeEach(async ({ page }) => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
  });

  test('focusOnFilesExplorer focuses the Files Explorer view', async ({ page }) => {
    await focusOnFilesExplorer(page);
    await expect(page.getByRole('tree', { name: /Files Explorer/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('saveFile clears the dirty indicator', async ({ page }) => {
    await openFileByName(page, 'sfdx-project.json');
    const editor = page.locator(EDITOR_WITH_URI).first();
    await expect(editor).toBeVisible({ timeout: 10_000 });
    await editor.click();
    await goToLineColumn(page);
    await page.keyboard.type('1:1');
    await page.keyboard.press('Enter');
    await page.keyboard.type(' ');
    const dirtyTab = page.locator(`${TAB}.dirty`).filter({ hasText: 'sfdx-project.json' });
    await expect(dirtyTab).toBeVisible({ timeout: 10_000 });

    await saveFile(page);
    await expect(dirtyTab).not.toBeVisible({ timeout: 10_000 });
  });

  test('showExplorer reveals the Explorer sidebar', async ({ page }) => {
    await showExplorer(page);
    await expect(page.getByRole('tree', { name: /Files Explorer/i }).first()).toBeVisible({ timeout: 10_000 });
  });
});
