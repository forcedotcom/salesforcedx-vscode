/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import { openSettingsUI, upsertSettings } from '../../../src/pages/settings';
import { saveScreenshot } from '../../../src/shared/screenshotUtils';
import { waitForVSCodeWorkbench, closeWelcomeTabs, ensureSecondarySideBarHidden } from '../../../src/utils/helpers';
import { SETTINGS_SEARCH_INPUT } from '../../../src/utils/locators';
import { test } from '../fixtures/index';

test.describe.serial('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
  });

  test('should open settings UI', async ({ page }) => {
    await test.step('Open settings UI', async () => {
      await openSettingsUI(page);
    });

    await test.step('Verify settings UI is visible', async () => {
      const searchInput = page.locator(SETTINGS_SEARCH_INPUT[0]);
      await expect(searchInput).toBeVisible();
    });

    await test.step('Verify Workspace tab is active', async () => {
      const workspaceTab = page.getByRole('tab', { name: 'Workspace' });
      await expect(workspaceTab).toHaveAttribute('aria-selected', 'true', { timeout: 3000 });
      await saveScreenshot(page, 'settings.workspaceTabActive.png', false);
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

    await test.step('Update textbox setting and verify', async () => {
      // upsertSettings already verifies the value is set correctly internally
      await upsertSettings(page, { [settingKey]: settingValue });
    });
  });

  test('should upsert multiple settings simultaneously', async ({ page }) => {
    const settings = {
      'editor.fontSize': '18',
      'editor.autoClosingBrackets': 'never'
    };

    await test.step('Update multiple settings and verify', async () => {
      // upsertSettings already verifies the value is set correctly internally
      await upsertSettings(page, settings);
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
      // Clear existing search before typing
      await page.keyboard.press('Control+KeyA');
      await page.keyboard.press('Backspace');
      await page.keyboard.type(settingKey);

      const allDotsId = `searchResultModel_${settingKey.replaceAll('.', '_')}`;
      const firstDotId = `searchResultModel_${settingKey.replace('.', '_')}`;
      const dataIdSelector =
        allDotsId === firstDotId ? `[data-id="${allDotsId}"]` : `[data-id="${allDotsId}"], [data-id="${firstDotId}"]`;
      const row = page.locator(dataIdSelector).last();
      await row.waitFor({ state: 'visible', timeout: 15_000 });
      const minimapCheckbox = row.getByRole('checkbox').first();
      await expect(minimapCheckbox).not.toBeChecked();
    });
  });
});
