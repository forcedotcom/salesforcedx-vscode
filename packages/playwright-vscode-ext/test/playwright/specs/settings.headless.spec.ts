/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  openSettingsUI,
  upsertSettings
} from '../../../src/pages/settings';
import {
  waitForVSCodeWorkbench,
  closeWelcomeTabs
} from '../../../src/utils/helpers';
import { SETTINGS_SEARCH_INPUT } from '../../../src/utils/locators';
import { test } from '../fixtures/index';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
  });

  test('should open settings UI', async ({ page }) => {
    await test.step('Open settings UI', async () => {
      await openSettingsUI(page);
    });

    await test.step('Verify settings UI is visible', async () => {
      const searchInput = page.locator(SETTINGS_SEARCH_INPUT[0]);
      await expect(searchInput).toBeVisible();
    });
  });

  test('should search for settings', async ({ page }) => {
    await test.step('Open settings UI', async () => {
      await openSettingsUI(page);
    });

    await test.step('Search for a setting', async () => {
      const searchInput = page.locator(SETTINGS_SEARCH_INPUT[0]);
      await searchInput.click();
      await page.keyboard.type('editor.fontSize');
    });

    await test.step('Verify search results appear', async () => {
      const settingRow = page.locator('.settings-editor').getByText('Font Size', { exact: false }).first();
      await expect(settingRow).toBeVisible();
    });
  });

  test('should modify textbox setting', async ({ page }) => {
    const settingKey = 'editor.fontSize';
    const settingValue = '16';

    await test.step('Update textbox setting', async () => {
      await upsertSettings(page, { [settingKey]: settingValue });
    });

    await test.step('Verify setting was updated', async () => {
      await openSettingsUI(page);
      const searchInput = page.locator(SETTINGS_SEARCH_INPUT[0]);
      await searchInput.click();
      // Clear any existing text first
      await page.keyboard.press('Control+KeyA');
      await page.keyboard.press('Backspace');
      // Search for modified settings with the key name to filter to just this setting
      await page.keyboard.type(`@modified ${settingKey}`);

      // Wait for search results to appear
      await page.locator('.settings-editor').waitFor({ state: 'visible', timeout: 5000 });

      // After searching for @modified editor.fontSize, there should be only one spinbutton
      const fontSizeInput = page.locator('.settings-editor').getByRole('spinbutton').first();
      await expect(fontSizeInput).toHaveValue(settingValue);
    });
  });

  test('should modify checkbox setting', async ({ page }) => {
    const settingKey = 'editor.minimap.enabled';
    const settingValue = 'false';

    await test.step('Update checkbox setting', async () => {
      await upsertSettings(page, { [settingKey]: settingValue });
    });

    await test.step('Verify setting was updated', async () => {
      await openSettingsUI(page);
      const searchInput = page.locator(SETTINGS_SEARCH_INPUT[0]);
      await searchInput.click();
      await page.keyboard.type(settingKey);

      const minimapCheckbox = page.locator('.settings-editor').getByRole('checkbox', { name: /minimap/i });
      await expect(minimapCheckbox).not.toBeChecked();
    });
  });
});
