/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import { executeCommandWithCommandPalette, openCommandPalette } from '../../../src/pages/commands';
import {
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  isMacDesktop
} from '../../../src/utils/helpers';
import { QUICK_INPUT_WIDGET, WORKBENCH } from '../../../src/utils/locators';
import { test } from '../fixtures/index';

test.describe('Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
  });

  test('should open command palette with F1', async ({ page }) => {
    await test.step('Press F1 to open command palette', async () => {
      // Use helper function that has retry logic to handle welcome tabs
      await openCommandPalette(page);
      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await expect(quickInput).toBeVisible();
    });
  });

  test('should execute command via command palette', async ({ page }) => {
    await test.step('Execute "View: Close All Editors" command', async () => {
      await executeCommandWithCommandPalette(page, 'View: Close All Editors');
      // Wait for tabs to close - command execution may take a moment
      const tabs = page.locator('.tabs-container .tab');
      await expect(tabs).toHaveCount(0, { timeout: 10_000 });
    });
  });

  test('should support command palette with Ctrl+Shift+P', async ({ page }) => {
    // Ctrl+Shift+P doesn't reliably work on macOS Electron - skip there
    test.skip(isMacDesktop(), 'Ctrl+Shift+P keyboard shortcut unreliable on Mac desktop Electron');

    await test.step('Press Ctrl+Shift+P to open command palette', async () => {
      // Focus on the workbench by clicking on it first
      const workbench = page.locator('[id="workbench.parts.editor"]').first();
      await workbench
        .click({ position: { x: 10, y: 10 } })
        .catch(() => page.locator(WORKBENCH).click());

      await page.keyboard.press('Control+Shift+P');
      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await expect(quickInput).toBeVisible({ timeout: 5000 });
    });

    await test.step('Close command palette with Escape', async () => {
      await page.keyboard.press('Escape');
      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await expect(quickInput).not.toBeVisible();
    });
  });
});
