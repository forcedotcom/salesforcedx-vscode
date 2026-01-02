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
  NOTIFICATION_LIST_ITEM,
  TAB
} from '@salesforce/playwright-vscode-ext';
import { waitForRetrieveProgressNotificationToAppear } from '../pages/notifications';

test.setTimeout(10 * 60 * 1000);

test.beforeEach(async ({ page }) => {
  const createResult = await createDreamhouseOrg();
  const orgBrowserPage = new OrgBrowserPage(page);
  await upsertScratchOrgAuthFieldsToSettings(page, createResult, () => orgBrowserPage.waitForProject());
});

test('Org Browser - CustomTab retrieval: custom-tab headless: retrieve Broker__c tab', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);

  await test.step('open Org Browser', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  await test.step('find CustomTab type', async () => {
    const locator = await orgBrowserPage.findMetadataType('CustomTab');
    await locator.hover();
    await expect(locator).toMatchAriaSnapshot({ name: 'customtab-hover' });
  });

  const brokerItem = await test.step('expand CustomTab and locate Broker__c', async () => {
    await orgBrowserPage.expandFolder('CustomTab');
    const item = await orgBrowserPage.getMetadataItem('CustomTab', 'Broker__c');
    await item.hover();
    await expect(item).toMatchAriaSnapshot({ name: 'customtab-broker__c' });
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
    await orgBrowserPage.waitForFileToOpenInEditor(300_000);
  });

  await test.step('verify editor is visible and capture final state', async () => {
    const editorPart = page.locator('#workbench\\.parts\\.editor');
    await expect(editorPart).toBeVisible();
    const anyEditorTab = page.locator(TAB).first();
    await expect(anyEditorTab).toBeVisible();
    const brokerTab = page.getByRole('tab', { name: /Broker__c/i }).first();
    await expect(brokerTab).toBeVisible();
    await expect(brokerTab).toMatchAriaSnapshot({ name: 'customtab-broker__c-editor' });
  });

  await test.step('visual assertion: Broker__c shows filled circle', async () => {
    await expect(brokerItem.locator('div.custom-view-tree-node-item-icon')).toContainClass('codicon-pass-filled');
    await expect(brokerItem).toMatchAriaSnapshot({ name: 'customtab-broker__c-filled' });
  });

  await test.step('override confirmation for a single file', async () => {
    await orgBrowserPage.clickRetrieveButton(brokerItem);

    const overwrite = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /Overwrite\s+local\s+files\s+for/i })
      .first();
    await expect(overwrite).toBeVisible();
    await expect(overwrite).toContainText(/Overwrite\s+local\s+files\s+for\s+\d+\s+CustomTab\s*\?/i);

    await overwrite.getByRole('button', { name: /^Yes$/ }).click();

    const retrieving = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /Retrieving\s+CustomTab/i })
      .first();
    await expect(retrieving).toBeVisible({ timeout: 60_000 });
  });

  await test.step('download all customTabs from the type-level retrieve icon', async () => {
    const originalTabTexts = await page.locator(TAB).allTextContents();
    const typeLocator = await orgBrowserPage.findMetadataType('CustomTab');
    await orgBrowserPage.clickRetrieveButton(typeLocator);

    const overwrite = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /Overwrite\s+local\s+files\s+for/i })
      .first();
    await expect(overwrite).toBeVisible();
    await expect(overwrite).toContainText(/Overwrite\s+local\s+files\s+for\s+\d+\s+CustomTab\s*\?/i);

    await overwrite.getByRole('button', { name: /^Yes$/ }).click();

    const retrieving = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /Retrieving\s+CustomTab/i })
      .first();
    await expect(retrieving).toBeVisible({ timeout: 60_000 });

    // we didn't open any additional files on a "retrieve all"
    expect(await page.locator(TAB).allTextContents()).toEqual(originalTabTexts);
  });
});
