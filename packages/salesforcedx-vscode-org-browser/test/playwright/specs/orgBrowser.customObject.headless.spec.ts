/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { test } from '../fixtures';
import { expect } from '@playwright/test';
import { OrgBrowserPage } from '../pages/orgBrowserPage';
import {
  upsertScratchOrgAuthFieldsToSettings,
  createDreamhouseOrg,
  NOTIFICATION_LIST_ITEM
} from '@salesforce/playwright-vscode-ext';
import { waitForRetrieveProgressNotificationToAppear } from '../pages/notifications';
import { RETRIEVE_TIMEOUT_MS } from '../constants';

test.setTimeout(RETRIEVE_TIMEOUT_MS);

test.beforeEach(async ({ page }) => {
  const createResult = await createDreamhouseOrg();
  const orgBrowserPage = new OrgBrowserPage(page);
  await upsertScratchOrgAuthFieldsToSettings(page, createResult, () => orgBrowserPage.waitForProject());
});

test('Org Browser - CustomObject retrieval: customobject headless: retrieve Broker__c', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);

  await test.step('open Org Browser', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  await test.step('find CustomObject type', async () => {
    const locator = await orgBrowserPage.findMetadataType('CustomObject');
    await locator.hover();
    await expect(locator).toMatchAriaSnapshot({ name: 'customobject-found' });
  });

  const brokerItem = await test.step('expand CustomObject and locate Broker__c', async () => {
    await orgBrowserPage.expandFolder('CustomObject');
    const item = await orgBrowserPage.getMetadataItem('CustomObject', 'Broker__c');
    await item.hover();
    // Wait for toolbar buttons to appear before taking snapshot
    await expect(item.locator('.action-label[aria-label="Retrieve Metadata"]').first(), 'Retrieve button should be visible').toBeVisible({ timeout: 3000 });
    // Wait for file presence icon to appear (set asynchronously via background check)
    // Use innerHTML to inspect structure - icon appears when file presence check completes
    // Wait for aria snapshot which will wait for expected structure including the icon
    // The snapshot expects two icons before "Broker__c" text
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
    await orgBrowserPage.waitForFileToOpenInEditor(RETRIEVE_TIMEOUT_MS);
  });

  await test.step('override confirmation for Broker__c', async () => {
    await orgBrowserPage.clickRetrieveButton(brokerItem);

    const overwrite = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /Overwrite\s+local\s+files\s+for/i })
      .first();
    await expect(overwrite).toBeVisible();
    await expect(overwrite).toContainText(/Overwrite\s+local\s+files\s+for\s+\d+\s+CustomObject\s*\?/i);

    await overwrite.getByRole('button', { name: /^Yes$/ }).click();

    const retrieving = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /Retrieving\s+CustomObject/i })
      .first();
    await expect(retrieving).toBeVisible({ timeout: 60_000 });
    await expect(retrieving).not.toBeVisible({ timeout: RETRIEVE_TIMEOUT_MS });
  });
});
