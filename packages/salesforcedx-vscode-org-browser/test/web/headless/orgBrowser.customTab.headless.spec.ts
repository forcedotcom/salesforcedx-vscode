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
import { waitForRetrieveProgressNotificationToAppear } from '../pages/notifications';

test.describe('Org Browser - CustomTab retrieval (headless)', () => {
  test.setTimeout(10 * 60 * 1000);

  test.beforeEach(async ({ page }) => {
    const createResult = await create();
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
  });

  test('custom-tab headless: retrieve Broker__c tab', async ({ page }) => {
    const orgBrowserPage = new OrgBrowserPage(page);

    await test.step('open Org Browser', async () => {
      await orgBrowserPage.openOrgBrowser();
    });

    const customTabType = await test.step('find CustomTab type', async () => {
      const locator = await orgBrowserPage.findMetadataType('CustomTab');
      await locator.hover({ timeout: 500 });
      await expect(locator).toMatchAriaSnapshot({ name: 'customtab-hover' });
      return locator;
    });

    const brokerItem = await test.step('expand CustomTab and locate Broker__c', async () => {
      await orgBrowserPage.expandFolder(customTabType);
      const item = await orgBrowserPage.getMetadataItem('CustomTab', 'Broker__c');
      await item.hover({ timeout: 500 });
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
      const fileOpened = await orgBrowserPage.waitForFileToOpenInEditor(120_000);
      expect(fileOpened).toBe(true);
    });

    await test.step('verify editor is visible and capture final state', async () => {
      const editorPart = page.locator('#workbench\\.parts\\.editor');
      await expect(editorPart).toBeVisible();
      const anyEditorTab = page.locator('.monaco-workbench .tabs-container .tab').first();
      await expect(anyEditorTab).toBeVisible();
      const brokerTab = page.getByRole('tab', { name: /Broker__c/i }).first();
      await expect(brokerTab).toBeVisible();
      await expect(brokerTab).toMatchAriaSnapshot({ name: 'customtab-broker__c-editor' });
    });

    await test.step('visual assertion: Broker__c shows filled circle', async () => {
      // move mouse away to avoid hover visuals
      await expect(brokerItem.locator('div.custom-view-tree-node-item-icon')).toContainClass('codicon-pass-filled');
      await expect(brokerItem).toMatchAriaSnapshot({ name: 'customtab-broker__c-filled' });
    });

    await test.step('override confirmation for a single file', async () => {
      await orgBrowserPage.clickRetrieveButton(brokerItem);

      const overwrite = page
        .locator('.monaco-workbench .notification-list-item')
        .filter({ hasText: /Overwrite\s+local\s+files\s+for/i })
        .first();
      await expect(overwrite).toBeVisible();
      await expect(overwrite).toContainText(/Overwrite\s+local\s+files\s+for\s+\d+\s+CustomTab\s*\?/i);

      await overwrite.getByRole('button', { name: /^Yes$/ }).click();

      const retrieving = page
        .locator('.monaco-workbench .notification-list-item')
        .filter({ hasText: /Retrieving\s+CustomTab/i })
        .first();
      await expect(retrieving).toBeVisible({ timeout: 60_000 });
    });

    await test.step('download all customTabs from the type-level retrieve icon', async () => {
      const originalTabTexts = await page.locator('.monaco-workbench .tabs-container .tab').allTextContents();

      await orgBrowserPage.clickRetrieveButton(customTabType);

      const overwrite = page
        .locator('.monaco-workbench .notification-list-item')
        .filter({ hasText: /Overwrite\s+local\s+files\s+for/i })
        .first();
      await expect(overwrite).toBeVisible();
      await expect(overwrite).toContainText(/Overwrite\s+local\s+files\s+for\s+\d+\s+CustomTab\s*\?/i);

      await overwrite.getByRole('button', { name: /^Yes$/ }).click();

      const retrieving = page
        .locator('.monaco-workbench .notification-list-item')
        .filter({ hasText: /Retrieving\s+CustomTab/i })
        .first();
      await expect(retrieving).toBeVisible({ timeout: 60_000 });

      // we didn't open any additional files on a "retrieve all"
      expect(await page.locator('.monaco-workbench .tabs-container .tab').allTextContents()).toEqual(originalTabTexts);
    });
  });
});
