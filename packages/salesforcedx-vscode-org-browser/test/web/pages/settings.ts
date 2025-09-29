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
import { waitForVSCodeWorkbench } from '../utils/headless-helpers';
import { OrgBrowserPage } from './orgBrowserPage';
import type { AuthFields } from '@salesforce/core';
import { executeCommandWithCommandPalette } from './commands';

const settingsLocator = (page: Page): Locator =>
  page.locator(
    [
      '#workbench\\.parts\\.editor .settings-header .search-container .monaco-editor',
      '[aria-label="Settings"] .settings-header .search-container .monaco-editor'
    ].join(',')
  );

/** Open the Command Palette and execute Preferences: Open Settings (UI) */
export const openSettingsUI = async (page: Page): Promise<void> => {
  await page.waitForSelector('.monaco-workbench', { timeout: 60000 });
  await page.locator('.monaco-workbench').click({ timeout: 5000 });
  await page.waitForTimeout(2000);
  await executeCommandWithCommandPalette(page, 'Preferences: Open Settings UI');
  await settingsLocator(page).first().waitFor({ timeout: 3000 });
};

export const upsertScratchOrgAuthFieldsToSettings = async (
  page: Page,
  authFields: Required<Pick<AuthFields, 'instanceUrl' | 'accessToken' | 'instanceApiVersion'>>
): Promise<void> => {
  await waitForVSCodeWorkbench(page);
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
export const upsertSettings = async (page: Page, settings: Record<string, string>): Promise<void> => {
  await openSettingsUI(page);
  const debugAria = process.env.E2E_ARIA_DEBUG === '1';

  const searchMonaco = settingsLocator(page).first();

  const performSearch = async (query: string): Promise<void> => {
    await searchMonaco.click();
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

    // Prefer deterministic search result id for the exact setting id
    const searchResultId = `searchResultModel_${id.replace(/\./g, '_')}`;
    const rowById = page.locator(`.setting-item[data-id="${searchResultId}"]`).first();
    await Promise.any([
      rowById.waitFor({ state: 'attached', timeout: 5000 }),
      page
        .getByText(/Setting Found/i)
        .first()
        .waitFor({ timeout: 5000 })
    ]).catch(() => undefined);

    let row = rowById;
    const present = (await rowById.count()) > 0;
    if (!present) {
      // Fallback to label text if the deterministic id isn't present
      const keyOnly = id.split('.').pop() ?? id;
      const labelRegex = /instanceUrl$/i.test(id)
        ? /instance\s*url/i
        : /accessToken$/i.test(id)
          ? /access\s*token/i
          : /apiVersion$/i.test(id)
            ? /api\s*version/i
            : new RegExp(keyOnly.replace(/[-_.]/g, '\\s*'), 'i');
      row = page
        .locator('.setting-item')
        .filter({ has: page.locator('.setting-item-title') })
        .filter({ hasText: labelRegex })
        .first();
      await row.waitFor({ state: 'attached', timeout: 15000 });
    }

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

    // Capture after state
    await saveScreenshot(page, `settings.afterSet.${id}.png`, false);
    if (debugAria) {
      try {
        const ariaAfter = await page.locator('body').ariaSnapshot();
        console.log(`[ARIA after ${id}]\n${ariaAfter}`);
      } catch {}
    }

    // Reset search by selecting all and clearing
    // sometimes the first click gets blurred, so do it again
    await searchMonaco.click({ timeout: 5000 });
    await searchMonaco.click({ timeout: 5000 });
    await searchMonaco.click({ timeout: 5000 });

    await page.keyboard.press('Control+KeyA');
    await page.keyboard.press('Backspace');
  }
};
