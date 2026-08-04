/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { test } from '../fixtures';
import { expect } from '@playwright/test';
import { OrgBrowserPage } from '../pages/orgBrowserPage';
import {
  clickModalDialogButton,
  closeWelcomeTabs,
  createDreamhouseOrg,
  ensureSecondarySideBarHidden,
  NOTIFICATION_LIST_ITEM,
  TAB,
  upsertScratchOrgAuthFieldsToSettings,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { waitForRetrieveProgressNotificationToAppear } from '../pages/notifications';
import { RETRIEVE_TIMEOUT_MS } from '../constants';

test.setTimeout(RETRIEVE_TIMEOUT_MS);

test.beforeEach(async ({ page }) => {
  const createResult = await createDreamhouseOrg();
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  const orgBrowserPage = new OrgBrowserPage(page);
  await upsertScratchOrgAuthFieldsToSettings(page, createResult, () => orgBrowserPage.waitForProject());
  await ensureSecondarySideBarHidden(page);
});

test('Org Browser - CustomTab retrieval: custom-tab headless: retrieve Broker__c tab', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);

  await test.step('open Org Browser', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  await test.step('find CustomTab type', async () => {
    const locator = await orgBrowserPage.findMetadataType('CustomTab');
    await locator.hover();
    // Type rows expose both refresh and retrieve actions.
    await expect(locator).toHaveRole('treeitem');
    await expect(locator).toHaveAttribute('aria-level', '1');
    await expect(OrgBrowserPage.getRefreshButton(locator)).toBeVisible();
    await expect(OrgBrowserPage.getRetrieveButton(locator)).toBeVisible();
  });

  const brokerItem = await test.step('expand CustomTab and locate Broker__c', async () => {
    await orgBrowserPage.expandFolder('CustomTab');
    const item = await orgBrowserPage.getMetadataItem('CustomTab', 'Broker__c');
    await item.hover();
    await expect(OrgBrowserPage.getRetrieveButton(item), 'Retrieve button should be visible').toBeVisible({
      timeout: 3000
    });
    // Component rows expose retrieve but not refresh.
    await expect(item).toHaveRole('treeitem');
    await expect(item).toHaveAttribute('aria-level', '2');
    await expect(OrgBrowserPage.getRefreshButton(item)).toHaveCount(0);
    await expect(OrgBrowserPage.getRetrieveButton(item)).toBeVisible();
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

  await test.step('verify editor is visible and capture final state', async () => {
    const editorPart = page.locator('#workbench\\.parts\\.editor');
    await expect(editorPart).toBeVisible();
    const anyEditorTab = page.locator(TAB).first();
    await expect(anyEditorTab).toBeVisible();
    const brokerTab = page.getByRole('tab', { name: /Broker__c/i }).first();
    await expect(brokerTab).toBeVisible();
    // Expected structure: tab element that is selected, with accessible name containing "Broker__c.tab-meta.xml"
    await expect(brokerTab).toHaveRole('tab');
    await expect(brokerTab).toHaveAttribute('aria-selected', 'true');
    await expect(brokerTab).toHaveAccessibleName(/Broker__c\.tab-meta\.xml/);
  });

  await test.step('Broker__c is marked as present locally and in the org', async () => {
    await expect(brokerItem.getByRole('img', { name: 'Present in the org and local project' })).toBeAttached();
    await expect(brokerItem).toHaveRole('treeitem');
    await expect(brokerItem).toHaveAttribute('aria-level', '2');
    await expect(OrgBrowserPage.getRetrieveButton(brokerItem)).toBeVisible();
  });

  await test.step('override confirmation for a single file', async () => {
    await orgBrowserPage.clickRetrieveButton(brokerItem);

    const dialog = page.locator('.monaco-dialog-box');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Overwrite\s+local\s+files\s+for\s+\d+\s+CustomTab\s*\?/i);

    await clickModalDialogButton(page, 'Yes');

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

    const dialog = page.locator('.monaco-dialog-box');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Overwrite\s+local\s+files\s+for\s+\d+\s+CustomTab\s*\?/i);

    await clickModalDialogButton(page, 'Yes');

    const retrieving = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /Retrieving\s+CustomTab/i })
      .first();
    await expect(retrieving).toBeVisible({ timeout: 60_000 });

    // we didn't open any additional files on a "retrieve all"
    expect(await page.locator(TAB).allTextContents()).toEqual(originalTabTexts);
  });
});
