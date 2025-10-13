/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Locator, Page, expect } from '@playwright/test';
import { saveScreenshot } from '../shared/screenshotUtils';
import {
  ACCESS_TOKEN_KEY,
  API_VERSION_KEY,
  CODE_BUILDER_WEB_SECTION,
  INSTANCE_URL_KEY
} from 'salesforcedx-vscode-services/src/constants';
import { waitForVSCodeWorkbench } from '../utils/helpers';
import { OrgBrowserPage } from './orgBrowserPage';
import type { AuthFields } from '@salesforce/core';
import { executeCommandWithCommandPalette } from './commands';
import { isDesktop } from '../fixtures';

const settingsLocator = (page: Page): Locator =>
  page.locator(
    [
      '#workbench\\.parts\\.editor .settings-header .search-container .monaco-editor',
      '[aria-label="Settings"] .settings-header .search-container .monaco-editor'
    ].join(',')
  );

/** Open the Command Palette and execute Preferences: Open Settings (UI) */
const openSettingsUI = async (page: Page): Promise<void> => {
  await page.waitForSelector('.monaco-workbench', { timeout: 60000 });
  await page.locator('.monaco-workbench').click({ timeout: 5000 });
  await page.waitForTimeout(2000);
  await executeCommandWithCommandPalette(page, 'Preferences: Open Settings UI');
  await settingsLocator(page).first().waitFor({ timeout: 3000 });
};

/** used for web, where auth fields need to be set to simulate what we'll receive from Core iframe.
 * Is a noop on desktop
 * */
export const upsertScratchOrgAuthFieldsToSettings = async (
  page: Page,
  authFields: Required<Pick<AuthFields, 'instanceUrl' | 'accessToken' | 'instanceApiVersion'>>
): Promise<void> => {
  // Desktop uses real CLI auth files, so just wait for workbench (no navigation, no settings)
  if (isDesktop) {
    // Page is already loaded by Electron fixture, just wait for project
    await new OrgBrowserPage(page).waitForProject();
    return;
  }

  // Web: navigate and manually set auth fields in settings
  await waitForVSCodeWorkbench(page, true);
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.waitForProject();
  await upsertSettings(page, {
    [`${CODE_BUILDER_WEB_SECTION}.${INSTANCE_URL_KEY}`]: authFields.instanceUrl,
    [`${CODE_BUILDER_WEB_SECTION}.${ACCESS_TOKEN_KEY}`]: authFields.accessToken,
    [`${CODE_BUILDER_WEB_SECTION}.${API_VERSION_KEY}`]: authFields.instanceApiVersion ?? '64.0'
  });
};

/** Upsert settings using Settings (UI) search and fill of each id.
 * Assumes that you've already opened the Settings (UI) via openSettingsUI.
 */
const upsertSettings = async (page: Page, settings: Record<string, string>): Promise<void> => {
  await openSettingsUI(page);
  const debugAria = process.env.E2E_ARIA_DEBUG === '1';

  const searchMonaco = settingsLocator(page).first();

  const performSearch = async (query: string): Promise<void> => {
    // Reset search by selecting all and clearing
    await searchMonaco.click();
    // seems to be necessary to avoid clearing the setting instead of the search box.
    // TODO: figure out what to actually wait for (ex: can I tell if it's focused?)
    await page.waitForTimeout(100);
    // TODO: this works in headless tests with playwright on local mac, and ControlOrMeta+A doesn't work!
    await page.keyboard.press('Control+KeyA');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(query);
  };

  for (const [id, value] of Object.entries(settings)) {
    // Debug visibility: take screenshot and aria snapshot before each search
    if (debugAria) {
      try {
        const aria = await page.locator('body').ariaSnapshot();
        console.log(`[ARIA before ${id}]\n${aria}`);
      } catch {}
    }

    // First try an exact search by full id (section.key)
    await performSearch(id);

    // Deterministic locator: target the element that actually contains the `data-id` attribute
    const searchResultId = `searchResultModel_${id.replace(/\./g, '_')}`;
    const rowById = page.locator(`[data-id="${searchResultId}"]`).first();

    if (debugAria) {
      console.log(`[upsertSettings] using deterministic locator for ${id}: data-id="${searchResultId}"`);
    }

    // Fail fast if the deterministic row isn't found — do not fall back to label-based heuristics
    await rowById.waitFor({ state: 'attached', timeout: 15000 });
    const row = rowById;

    await row.waitFor({ state: 'visible', timeout: 30000 });
    if (debugAria) {
      try {
        const rowHtml = await row.innerHTML();
        console.log(`[HTML setting row ${id}]\n${rowHtml.slice(0, 4000)}`);
      } catch {}
    }

    // Always fill via the row role textbox
    const roleTextbox = row.getByRole('textbox').first();
    await roleTextbox.waitFor({ timeout: 30000 });
    await roleTextbox.click({ timeout: 5000 });
    await roleTextbox.fill(value);
    await expect(roleTextbox).toHaveValue(value, { timeout: 10000 });
    await roleTextbox.blur();

    // Capture after state
    await saveScreenshot(page, `settings.afterSet.${id}.png`, false);
    if (debugAria) {
      try {
        const ariaAfter = await page.locator('body').ariaSnapshot();
        console.log(`[ARIA after ${id}]\n${ariaAfter}`);
      } catch {}
    }
  }
};
