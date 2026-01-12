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
  closeWelcomeTabs
} from '../../../src/utils/helpers';
import { executeCommandWithCommandPalette } from '../../../src/pages/commands';
import { QUICK_INPUT_WIDGET } from '../../../src/utils/locators';

test.describe('Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
  });

  test('should open command palette with F1', async ({ page }) => {
    await test.step('Press F1 to open command palette', async () => {
      await page.keyboard.press('F1');
      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await expect(quickInput).toBeVisible();
    });
  });

  test('should execute command via command palette', async ({ page }) => {
    await test.step('Execute "View: Close All Editors" command', async () => {
      await executeCommandWithCommandPalette(page, 'View: Close All Editors');
      // Verify no editor tabs remain
      const tabs = page.locator('.tabs-container .tab');
      await expect(tabs).toHaveCount(0);
    });
  });

  test('should support command palette on Windows', async ({ page }) => {
    await test.step('Press Ctrl+Shift+P to open command palette', async () => {
      await page.keyboard.press('Control+Shift+KeyP');
      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await expect(quickInput).toBeVisible();
    });

    await test.step('Close command palette with Escape', async () => {
      await page.keyboard.press('Escape');
      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await expect(quickInput).not.toBeVisible();
    });
  });
});
