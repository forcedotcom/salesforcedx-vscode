/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import { newUntitledTextFile, saveFile } from '../../../src/pages/nativeCommands';
import { closeWelcomeTabs, waitForVSCodeWorkbench } from '../../../src/utils/helpers';
import { ensureSecondarySideBarHidden } from '../../../src/utils/workflows';
import { test } from '../fixtures/index';

test('should save file using File: Save command', async ({ page }) => {
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);

  await test.step('Create new untitled file', async () => {
    await newUntitledTextFile(page);
    await expect(page.locator('.editor-instance').first()).toBeVisible({ timeout: 5000 });
  });

  await test.step('Type content into file', async () => {
    await page.keyboard.type('Test content for File: Save');
    await expect(page.locator('.tabs-container .tab').first()).toBeVisible();
  });

  await test.step('Save file using command palette', async () => {
    await saveFile(page);
  });
});
