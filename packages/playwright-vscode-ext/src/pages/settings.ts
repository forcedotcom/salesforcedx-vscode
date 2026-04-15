/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Locator, Page, expect } from '@playwright/test';
import type { AuthFields } from '@salesforce/core';
import { ACCESS_TOKEN_KEY, API_VERSION_KEY, CODE_BUILDER_WEB_SECTION, INSTANCE_URL_KEY } from '../constants';
import { saveScreenshot } from '../shared/screenshotUtils';
import {
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  closeSettingsTab,
  waitForWorkspaceReady,
  isMacDesktop,
  isDesktop
} from '../utils/helpers';
import { WORKBENCH, SETTINGS_SEARCH_INPUT } from '../utils/locators';

const settingsLocator = (page: Page): Locator => page.locator(SETTINGS_SEARCH_INPUT.join(','));

export const openSettingsUI = async (page: Page): Promise<void> => {
  await closeWelcomeTabs(page);
  await page.locator(WORKBENCH).click({ timeout: 60_000 });
  // Use keyboard shortcut instead of command palette (more reliable)
  // Mac desktop uses Meta (Command), all others use Control
  const shortcut = isMacDesktop() ? 'Meta+,' : 'Control+,';
  await page.keyboard.press(shortcut);
  await settingsLocator(page).first().waitFor({ timeout: 3000 });
  // Always switch to Workspace settings tab
  const workspaceTab = page.getByRole('tab', { name: 'Workspace' });
  await workspaceTab.click();
  await expect(workspaceTab).toHaveAttribute('aria-selected', 'true', { timeout: 3000 });
  // Workspace tab can trigger navigation / DOM replace; wait for search input to exist again before callers interact
  await page.waitForLoadState('domcontentloaded');
  await settingsLocator(page).first().waitFor({ state: 'visible', timeout: 15_000 });
};

/** used for web, where auth fields need to be set to simulate what we'll receive from Core iframe.
 * Is a noop on desktop
 * */
export const upsertScratchOrgAuthFieldsToSettings = async (
  page: Page,
  authFields: Required<Pick<AuthFields, 'instanceUrl' | 'accessToken' | 'instanceApiVersion'>>,
  waitForProject: () => Promise<void> = () => waitForWorkspaceReady(page)
): Promise<void> => {
  // Desktop uses real CLI auth files, so just wait for workbench (no navigation, no settings)
  if (isDesktop()) {
    // Page is already loaded by Electron fixture, just wait for project if callback provided
    if (waitForProject) {
      await waitForProject();
    }
    return;
  }

  // Web: navigate and manually set auth fields in settings
  await waitForVSCodeWorkbench(page, true);
  if (waitForProject) {
    await waitForProject();
  }
  await upsertSettings(page, {
    [`${CODE_BUILDER_WEB_SECTION}.${INSTANCE_URL_KEY}`]: authFields.instanceUrl,
    [`${CODE_BUILDER_WEB_SECTION}.${ACCESS_TOKEN_KEY}`]: authFields.accessToken,
    [`${CODE_BUILDER_WEB_SECTION}.${API_VERSION_KEY}`]: authFields.instanceApiVersion ?? '64.0'
  });
};

const performSearch =
  (page: Page) =>
  async (query: string): Promise<void> => {
    const searchMonaco = settingsLocator(page).first();
    await searchMonaco.waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForLoadState('domcontentloaded');

    // Focus search; tab switches or reloads can detach the node — retry after navigation settles
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await settingsLocator(page).first().click({ timeout: 5000 });
        break;
      } catch {
        await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
        await page.waitForTimeout(300);
      }
    }

    await page.waitForTimeout(150);
    // Monaco settings search may not expose textarea in the light DOM; use keyboard clear instead of textarea assertion
    const selectAllShortcut = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';
    await page.keyboard.press(selectAllShortcut);
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(100);
    await page.keyboard.type(query);
  };

/** Upsert settings using Settings (UI) search and fill of each id.
 * For checkbox settings, pass "true" or "false" as the value.
 */
export const upsertSettings = async (page: Page, settings: Record<string, string>): Promise<void> => {
  await openSettingsUI(page);
  const debugAria = process.env.E2E_ARIA_DEBUG === '1';

  for (const [id, value] of Object.entries(settings)) {
    // Debug visibility: take screenshot and aria snapshot before each search
    if (debugAria) {
      try {
        const aria = await page.locator('body').ariaSnapshot();
        console.log(`[ARIA before ${id}]\n${aria}`);
      } catch {}
    }

    await settingsLocator(page).first().waitFor({ timeout: 3000 });

    // Screenshot search box state before clear+type (debug: is previous search still there?)
    if (Object.keys(settings).length > 1) {
      await saveScreenshot(page, `settings.beforeSearch.${id.replaceAll('.', '_')}.png`, false);
    }

    // First try an exact search by full id (section.key)
    await performSearch(page)(id);

    // Screenshot search box state after clear+type (debug: did clear work, is query correct?)
    if (Object.keys(settings).length > 1) {
      await saveScreenshot(page, `settings.afterSearch.${id.replaceAll('.', '_')}.png`, false);
    }

    // Wait for search results to appear - wait for any search result element to indicate search completed
    await page.locator('[data-id^="searchResultModel_"]').first().waitFor({ state: 'attached', timeout: 15_000 });

    // VS Code sanitizeId(key) builds the data-id, but the behavior changed in 1.113:
    // < 1.113: replace(/[\.\/]/, '_') — only the FIRST dot replaced
    //          e.g. "a.b.c" → "searchResultModel_a_b.c"
    // ≥ 1.113: replace(/[\.\/]/g, '_') — ALL dots replaced
    //          e.g. "a.b.c" → "searchResultModel_a_b_c"
    // Keys with hyphens (e.g. salesforce-web-console.apiVersion) also map '-' → '_' in current Settings UI:
    //          → "searchResultModel_salesforce_web_console_apiVersion" (not ...salesforce-web-console_apiVersion)
    // Use OR selectors across versions; .last() when User + Workspace duplicate rows exist (Workspace tab).
    const allDotsId = `searchResultModel_${id.replaceAll('.', '_')}`;
    const firstDotId = `searchResultModel_${id.replace('.', '_')}`;
    const dotsHyphensSlashesId = `searchResultModel_${id.replaceAll(new RegExp('[-./]', 'g'), '_')}`;
    const dataIdSelector = [...new Set([allDotsId, firstDotId, dotsHyphensSlashesId])]
      .map(s => `[data-id="${s}"]`)
      .join(', ');
    // Suffix match is robust when VS Code's sanitizeId differs (still ends with _<keyLastSegment>, e.g. _apiVersion)
    const lastSegment = id.includes('.') ? id.slice(id.lastIndexOf('.') + 1) : id;
    const rowByKeySuffix = page
      .locator(`${WORKBENCH} [data-id^="searchResultModel_"][data-id$="_${lastSegment}"]`)
      .last();
    const row = page.locator(dataIdSelector).last().or(rowByKeySuffix);

    if (debugAria) {
      console.log(`[upsertSettings] using deterministic locator for ${id}: selector="${dataIdSelector}"`);
      // Capture HTML to debug selector issues - look for settings results
      try {
        const settingsBody = page.locator('.settings-body, .settings-tree-container, [class*="settings"]').first();
        const html = await settingsBody.innerHTML();
        console.log(`[upsertSettings] Settings results HTML:\n${html.slice(0, 12_000)}`);
        // Also try to find any element with data-id containing our search term
        const allDataIds = await page.locator('[data-id]').all();
        const dataIds = await Promise.all(allDataIds.map(el => el.getAttribute('data-id')));
        console.log(`[upsertSettings] All data-id attributes found: ${dataIds.filter(Boolean).join(', ')}`);
      } catch {}
    }

    try {
      await row.waitFor({ state: 'attached', timeout: 15_000 });
    } catch {
      // Full setting id sometimes yields no Settings hits; shorter query (key segment) surfaces the row
      await performSearch(page)(lastSegment);
      await page.locator('[data-id^="searchResultModel_"]').first().waitFor({ state: 'attached', timeout: 15_000 });
      await row.waitFor({ state: 'attached', timeout: 15_000 });
    }

    await row.waitFor({ state: 'visible', timeout: 30_000 });
    if (debugAria) {
      try {
        const rowHtml = await row.innerHTML();
        console.log(`[HTML setting row ${id}]\n${rowHtml.slice(0, 4000)}`);
      } catch {}
    }

    // Check if this is a checkbox setting (value is "true" or "false")
    const checkbox = row.getByRole('checkbox').first();
    const isCheckboxSetting = (value === 'true' || value === 'false') && (await checkbox.count()) > 0;

    if (isCheckboxSetting) {
      // Handle checkbox setting
      await checkbox.waitFor({ timeout: 30_000 });
      const isChecked = await checkbox.isChecked();
      const desiredChecked = value === 'true';
      if (isChecked !== desiredChecked) {
        await checkbox.click();
        await expect(checkbox).toHaveAttribute('aria-checked', desiredChecked ? 'true' : 'false', { timeout: 10_000 });
      }
    } else {
      // Check if this is a dropdown/select setting (combobox)
      const combobox = row.getByRole('combobox').first();
      const comboboxCount = await combobox.count();

      if (comboboxCount > 0) {
        // Handle dropdown/select setting
        await combobox.waitFor({ timeout: 30_000 });

        // Check if this is a native HTML select or custom VS Code dropdown
        const isNativeSelect = (await combobox.evaluate(el => el.tagName)) === 'SELECT';

        if (isNativeSelect) {
          // Desktop: Use native select API
          await combobox.selectOption(value);
        } else {
          // Web: Use custom dropdown interaction
          await combobox.click({ timeout: 5000 });

          // Wait for dropdown options to appear and select the desired value
          // VS Code dropdowns show options in monaco-list-row elements
          const option = page
            .locator('.monaco-list-row[role="option"]')
            .filter({ hasText: new RegExp(`^${value}$`, 'i') });
          await option.waitFor({ state: 'visible', timeout: 10_000 });
          await option.click();
        }

        // Verify the value was set
        await expect(combobox).toHaveValue(value, { timeout: 10_000 });
      } else {
        // Handle textbox or spinbutton setting.
        const roleTextbox = row.getByRole('textbox').first();
        const roleSpinbutton = row.getByRole('spinbutton').first();

        const textboxCount = await roleTextbox.count();

        const inputElement = textboxCount > 0 ? roleTextbox : roleSpinbutton;
        await inputElement.waitFor({ timeout: 30_000 });
        await inputElement.click({ timeout: 5000 });
        // fill() clears and types (reliable for both textbox and spinbutton; select-all + type can miss on desktop)
        await inputElement.fill(value);
        await inputElement.blur();
        await expect(inputElement).toHaveValue(value, { timeout: 10_000 });
      }
    }

    // Capture after state
    await saveScreenshot(page, `settings.afterSet.${id}.png`, false);
    if (debugAria) {
      try {
        const ariaAfter = await page.locator('body').ariaSnapshot();
        console.log(`[ARIA after ${id}]\n${ariaAfter}`);
      } catch {}
    }
  }

  // Wait for VS Code to persist settings to disk before closing the tab
  // VS Code writes settings asynchronously, and closing too quickly cancels the write
  await page.waitForTimeout(2000);

  // Close the settings overlay/tab so callers can open command palette etc.
  await closeSettingsTab(page);
};
