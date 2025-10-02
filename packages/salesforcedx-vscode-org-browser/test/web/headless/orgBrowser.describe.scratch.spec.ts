/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { test, expect } from '@playwright/test';
import { OrgBrowserPage } from '../pages/orgBrowserPage';
import { upsertScratchOrgAuthFieldsToSettings } from '../pages/settings';
import { create } from '../utils/dreamhouseScratchOrgSetup';

test.describe('Org Browser high-level validation', () => {
  test.setTimeout(10 * 60 * 1000);

  test.beforeEach(async ({ browser, page }) => {
    const createResult = await create();
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
  });

  test('a few types from describe', async ({ page }) => {
    const orgBrowserPage = new OrgBrowserPage(page);
    await orgBrowserPage.openOrgBrowser();
    await test.step('validate CustomObject', async () => {
      await orgBrowserPage.findMetadataType('CustomObject');
    });

    await test.step('validate StaticResource', async () => {
      // pick a node that will scroll a bit
      await orgBrowserPage.findMetadataType('StaticResource');
    });

    const tabType = await orgBrowserPage.findMetadataType('CustomTab');

    await test.step('CustomTab UI (not expanded)', async () => {
      await tabType.hover({ timeout: 500 });

      await expect(tabType).toMatchAriaSnapshot({ name: 'customtab-found' });
    });
  });
});
