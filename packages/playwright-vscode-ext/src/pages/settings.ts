/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { OrgAuthResult } from '../orgs/types';
import { type Locator, type Page, expect } from '@playwright/test';
import { parse, printParseErrorCode, type ParseError } from 'jsonc-parser';
import {
  ACCESS_TOKEN_KEY,
  API_VERSION_KEY,
  CODE_BUILDER_WEB_SECTION,
  INSTANCE_URL_KEY,
  SESSION_CONTEXT_KEY
} from '../constants';
import { saveScreenshot } from '../shared/screenshotUtils';
import { focusMonacoInput } from '../utils/focusMonacoInput';
import {
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  closeSettingsTab,
  waitForWorkspaceReady,
  isMacDesktop,
  isDesktop
} from '../utils/helpers';
import { WORKBENCH, SETTINGS_SEARCH_INPUT, EDITOR_WITH_URI, QUICK_INPUT_WIDGET } from '../utils/locators';
import { executeCommandWithCommandPalette } from './commands';

const settingsLocator = (page: Page): Locator => page.locator(SETTINGS_SEARCH_INPUT.join(','));

export const openSettingsUI = async (page: Page): Promise<void> => {
  await closeWelcomeTabs(page);
  await page.locator(WORKBENCH).click({ timeout: 60_000 });
  // Use keyboard shortcut instead of command palette (more reliable)
  // Mac desktop uses Meta (Command), all others use Control
  const shortcut = isMacDesktop() ? 'Meta+,' : 'Control+,';
  await page.keyboard.press(shortcut);
  await settingsLocator(page).first().waitFor({ timeout: 3000 });
  // Always switch to Workspace settings tab. Use exact match: a non-exact name substring-matches editor tabs
  // for files whose name contains "Workspace" (e.g. InWorkspaceClass*.cls), causing a strict-mode violation.
  const workspaceTab = page.getByRole('tab', { name: 'Workspace', exact: true });
  await workspaceTab.click();
  await expect(workspaceTab).toHaveAttribute('aria-selected', 'true', { timeout: 3000 });
};

/** used for web, where auth fields need to be set to simulate what we'll receive from Core iframe.
 * Is a noop on desktop
 * */
export const upsertScratchOrgAuthFieldsToSettings = async (
  page: Page,
  authFields: OrgAuthResult,
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
  await waitForVSCodeWorkbench(page);
  if (waitForProject) {
    await waitForProject();
  }
  // JSON-editor saves do not fire onDidChangeConfiguration in VS Code Web, so write the session metadata object
  // first, then the three auth settings through the Settings UI, which triggers the auth watcher.
  await upsertSettings(page, {
    [`${CODE_BUILDER_WEB_SECTION}.${SESSION_CONTEXT_KEY}`]: authFields.sessionContext,
    [`${CODE_BUILDER_WEB_SECTION}.${INSTANCE_URL_KEY}`]: authFields.instanceUrl,
    [`${CODE_BUILDER_WEB_SECTION}.${ACCESS_TOKEN_KEY}`]: authFields.accessToken,
    [`${CODE_BUILDER_WEB_SECTION}.${API_VERSION_KEY}`]: authFields.instanceApiVersion ?? '64.0'
  });
};

const performSearch =
  (page: Page) =>
  async (query: string): Promise<void> => {
    // Reset search by selecting all and clearing
    const searchMonaco = settingsLocator(page).first();
    await searchMonaco.waitFor({ timeout: 3000 });
    await searchMonaco.click();
    // seems to be necessary to avoid clearing the setting instead of the search box.
    // TODO: figure out what to actually wait for (ex: can I tell if it's focused?)
    await page.waitForTimeout(200);
    // Triple-click on Monaco editor to select all text (more reliable than Control+A)
    await searchMonaco.click({ clickCount: 3 });
    await page.waitForTimeout(100);
    // Clear using Backspace after selecting all
    await page.keyboard.press('Backspace');
    // Wait to ensure the backspace completes and search box is cleared
    await page.waitForTimeout(200);
    // Verify the search box is empty by checking the textarea value
    const textarea = searchMonaco.locator('textarea').first();
    await expect(textarea).toHaveValue('', { timeout: 2000 });
    // Type the new query
    await page.keyboard.type(query);
  };

/** Upsert settings using Settings (UI) search and fill of each id.
 * For checkbox settings, pass "true" or "false" as the value.
 * Object settings are replaced through VS Code's JSON editor without replacing other settings.
 */
export const upsertSettings = async (
  page: Page,
  settings: Record<string, string | Record<string, unknown>>
): Promise<void> => {
  const objectSettings = Object.entries(settings).filter(([, value]) => typeof value === 'object');
  if (objectSettings.length > 0) {
    await closeWelcomeTabs(page);
    await executeCommandWithCommandPalette(page, 'Preferences: Open User Settings (JSON)');
    await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'hidden' });
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="settings.json"]`).last();
    await editor.waitFor({ state: 'visible', timeout: 10_000 });
    await focusMonacoInput(editor);
    const document = (await editor.locator('.view-line').allTextContents()).join('\n').replaceAll('\u00a0', ' ');
    const errors: ParseError[] = [];
    const parsedDocument = (parse(document, errors) ?? {}) as Record<string, unknown>;
    if (errors.length > 0)
      throw new Error(
        `Invalid workspace settings JSON: ${errors.map(error => printParseErrorCode(error.error)).join(', ')}`
      );
    const updatedSettings = parsedDocument;
    for (const [settingId, value] of objectSettings) {
      const settingPath = settingId.split('.');
      const key = settingPath.pop();
      if (!key) throw new Error(`Invalid setting ID: ${settingId}`);
      let section = updatedSettings;
      for (const sectionName of settingPath) {
        const currentSection = section[sectionName];
        if (
          currentSection !== undefined &&
          (typeof currentSection !== 'object' || currentSection === null || Array.isArray(currentSection))
        ) {
          throw new Error(`Cannot update ${settingId}: ${sectionName} is not a settings section.`);
        }
        section[sectionName] = (currentSection ?? {}) as Record<string, unknown>;
        section = section[sectionName] as Record<string, unknown>;
      }
      section[key] = value;
    }
    // Monaco auto-indents each newline produced through keyboard.insertText, corrupting pretty-printed JSON.
    // A one-line document avoids editor indentation rewriting the supplied settings text.
    const replacement = JSON.stringify(updatedSettings);
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await expect(editor.locator('.view-line')).toHaveText('', { timeout: 5000 });
    await page.keyboard.insertText(replacement);
    await expect(async () => {
      const editedDocument = (await editor.locator('.view-line').allTextContents())
        .join('\n')
        .replaceAll('\u00a0', ' ');
      const editedErrors: ParseError[] = [];
      const parsedEditedDocument: unknown = parse(editedDocument, editedErrors);
      expect(editedErrors).toEqual([]);
      expect(editedDocument).toBe(replacement);
      expect(parsedEditedDocument).toEqual(JSON.parse(replacement));
    }).toPass({ timeout: 5000 });
    await page.keyboard.press('Control+S');
    await page.waitForTimeout(500);
    const saveError = page.getByText(/Unable to write into .*settings/i);
    if (await saveError.isVisible().catch(() => false)) {
      throw new Error('VS Code rejected the workspace settings JSON update.');
    }
    await page.keyboard.press('Control+W');
    await executeCommandWithCommandPalette(page, 'Preferences: Open User Settings (JSON)');
    await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'hidden' });
    const savedEditor = page.locator(`${EDITOR_WITH_URI}[data-uri$="settings.json"]`).last();
    await savedEditor.waitFor({ state: 'visible', timeout: 10_000 });
    const savedDocument = (await savedEditor.locator('.view-line').allTextContents())
      .join('\n')
      .replaceAll('\u00a0', ' ');
    const savedErrors: ParseError[] = [];
    parse(savedDocument, savedErrors);
    expect(savedErrors).toEqual([]);
    expect(savedDocument).toBe(replacement);
    for (const [id, value] of objectSettings) {
      const actual = id.split('.').reduce<unknown>((section, key) => {
        if (typeof section !== 'object' || section === null) return undefined;
        return (section as Record<string, unknown>)[key];
      }, updatedSettings);
      expect(actual).toMatchObject(value as Record<string, unknown>);
    }
    await page.keyboard.press('Control+W');
  }

  const scalarSettings = Object.entries(settings).filter(([, value]) => typeof value !== 'object');
  if (scalarSettings.length === 0) return;

  await openSettingsUI(page);
  const debugAria = process.env.E2E_ARIA_DEBUG === '1';

  for (const [id, value] of scalarSettings) {
    if (typeof value !== 'string') continue;
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
    // Use an OR selector so this works across VS Code versions.
    // Use .last() when duplicates exist (User + Workspace): we're on Workspace tab, so Workspace row is last
    const allDotsId = `searchResultModel_${id.replaceAll('.', '_')}`;
    const firstDotId = `searchResultModel_${id.replace('.', '_')}`;
    const dataIdSelector =
      allDotsId === firstDotId ? `[data-id="${allDotsId}"]` : `[data-id="${allDotsId}"], [data-id="${firstDotId}"]`;
    const row = page.locator(dataIdSelector).last();

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

    await row.waitFor({ state: 'attached', timeout: 15_000 });

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
