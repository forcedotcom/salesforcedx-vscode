/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { test } from '../fixtures';
import { expect } from '@playwright/test';
import { OrgBrowserPage } from '../pages/orgBrowserPage';
import { upsertScratchOrgAuthFieldsToSettings } from '../pages/settings';
import { create } from '../utils/dreamhouseScratchOrgSetup';
import { waitForRetrieveProgressNotificationToAppear } from '../pages/notifications';

test.describe('Org Browser - CustomObject retrieval', () => {
  test.setTimeout(2 * 60 * 1000);

  test.beforeEach(async ({ page }) => {
    const createResult = await create();
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
  });

  test('customobject headless: retrieve Broker__c', async ({ page }) => {
    const orgBrowserPage = new OrgBrowserPage(page);

    await test.step('open Org Browser', async () => {
      await orgBrowserPage.openOrgBrowser();
    });

    const customObjectType = await test.step('find CustomObject type', async () => {
      const locator = await orgBrowserPage.findMetadataType('CustomObject');
      await locator.hover();
      await expect(locator).toMatchAriaSnapshot({ name: 'customobject-found' });
      return locator;
    });

    const brokerItem = await test.step('expand CustomObject and locate Broker__c', async () => {
      await orgBrowserPage.expandFolder(customObjectType);
      const item = await orgBrowserPage.getMetadataItem('CustomObject', 'Broker__c');
      await item.hover();
      await expect(item).toMatchAriaSnapshot({ name: 'customobject-broker__c' });
      return item;
    });

    await test.step('trigger retrieval', async () => {
      const clicked = await orgBrowserPage.clickRetrieveButton(brokerItem);
      expect(clicked).toBe(true);
    });

    await test.step('wait for retrieval progress to appear', async () => {
      await waitForRetrieveProgressNotificationToAppear(page, 60_000);
    });

    await test.step('wait for editor file to open (completion signal)', async () => {
      await orgBrowserPage.waitForFileToOpenInEditor(120_000);
    });

    await test.step('override confirmation for Broker__c', async () => {
      await orgBrowserPage.clickRetrieveButton(brokerItem);

      const overwrite = page
        .locator('.monaco-workbench .notification-list-item')
        .filter({ hasText: /Overwrite\s+local\s+files\s+for/i })
        .first();
      await expect(overwrite).toBeVisible();
      await expect(overwrite).toContainText(/Overwrite\s+local\s+files\s+for\s+\d+\s+CustomObject\s*\?/i);

      await overwrite.getByRole('button', { name: /^Yes$/ }).click();

      const retrieving = page
        .locator('.monaco-workbench .notification-list-item')
        .filter({ hasText: /Retrieving\s+CustomObject/i })
        .first();
      await expect(retrieving).toBeVisible({ timeout: 60_000 });
      await expect(retrieving).not.toBeVisible({ timeout: 60_000 });
    });
  });
});
