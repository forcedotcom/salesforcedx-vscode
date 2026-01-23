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

/** Headless-like test for foldered Report retrieval */
test.setTimeout(RETRIEVE_TIMEOUT_MS);

test.beforeEach(async ({ page }) => {
  const createResult = await createDreamhouseOrg();
  const orgBrowserPage = new OrgBrowserPage(page);
  await upsertScratchOrgAuthFieldsToSettings(page, createResult, () => orgBrowserPage.waitForProject());
});

test('Org Browser - Foldered Report retrieval: foldered report headless: retrieve flow_orchestration_log from unfiled$public', async ({
  page
}) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  const reportType = 'Report';
  let reportName: string | undefined;

  await test.step('open Org Browser', async () => {
    await orgBrowserPage.openOrgBrowser();
  });

  await test.step('find Report type, download not available', async () => {
    const locator = await orgBrowserPage.findMetadataType(reportType);
    await locator.hover();
    // Expected structure: treeitem at level 1 with accessible name containing "Report",
    // toolbar containing Refresh Type button only (Retrieve Metadata button is hidden for folder types)
    await expect(locator).toHaveRole('treeitem');
    await expect(locator).toHaveAttribute('aria-level', '1');
    await expect(locator).toHaveAccessibleName(/Report/);
    await expect(locator.locator('[aria-label="Refresh Type"]')).toBeVisible();
    await expect(locator.locator('.action-label[aria-label="Retrieve Metadata"]')).toBeHidden();
  });

  const folderName = 'unfiled$public';

  await test.step('expand Report and locate unfiled$public folder, download not available', async () => {
    await orgBrowserPage.findMetadataType(reportType);
    await orgBrowserPage.expandFolder(reportType);
    const folder = await orgBrowserPage.getMetadataItem('Report', folderName, 2);
    await expect(folder).toBeVisible();
    await expect(folder.locator('.action-label[aria-label="Retrieve Metadata"]')).toBeHidden();
    await orgBrowserPage.expandFolder(folderName);
  });

  await test.step('locate first report item in folder', async () => {
    const level3 = await orgBrowserPage.getMetadataItem(
      'unfiled$public',
      'unfiled$public/flow_screen_prebuilt_report',
      3
    );
    const txt = (await level3.textContent())?.trim() ?? '';
    reportName = txt.split('/').pop();
    await level3.hover({ timeout: 500 });
    // Expected structure: treeitem at level 3 (nested under folder) with toolbar containing Retrieve Metadata button
    await expect(level3).toHaveRole('treeitem');
    await expect(level3).toHaveAttribute('aria-level', '3');
    await expect(level3.locator('[aria-label="Retrieve Metadata"]')).toBeVisible();
    return level3;
  });

  await test.step('trigger retrieval on a single report', async () => {
    const reportItem = await orgBrowserPage.getMetadataItem(
      'unfiled$public',
      'unfiled$public/flow_screen_prebuilt_report',
      3
    );
    const clicked = await orgBrowserPage.clickRetrieveButton(reportItem);
    expect(clicked).toBe(true);
  });

  await test.step('wait for retrieval progress to appear', async () => {
    await waitForRetrieveProgressNotificationToAppear(page, 60_000);
  });

  await test.step('wait for editor file to open (completion signal)', async () => {
    await orgBrowserPage.waitForFileToOpenInEditor(RETRIEVE_TIMEOUT_MS);
  });

  await test.step('verify editor shows the report tab and capture', async () => {
    const editorPart = page.locator('#workbench\\.parts\\.editor');
    await expect(editorPart).toBeVisible();
    const safeName = (reportName ?? '').replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const reportTab = page.getByRole('tab', { name: new RegExp(safeName, 'i') }).first();
    await expect(reportTab).toBeVisible();
    // Expected structure: tab element that is selected, with accessible name containing ".report-meta.xml"
    await expect(reportTab).toHaveRole('tab');
    await expect(reportTab).toHaveAttribute('aria-selected', 'true');
    await expect(reportTab).toHaveAccessibleName(/\.report-meta\.xml/);
  });

  await test.step('override confirmation for a single report', async () => {
    const reportItem = await orgBrowserPage.getMetadataItem(
      'unfiled$public',
      'unfiled$public/flow_screen_prebuilt_report',
      3
    );
    await orgBrowserPage.clickRetrieveButton(reportItem);

    const overwrite = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /Overwrite\s+local\s+files\s+for/i })
      .first();
    await expect(overwrite).toBeVisible();
    await expect(overwrite).toContainText(/Overwrite\s+local\s+files\s+for\s+\d+\s+Report\s*\?/i);

    await overwrite.getByRole('button', { name: /^Yes$/ }).click();

    const retrieving = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /Retrieving\s+Report/i })
      .first();
    await expect(retrieving).toBeVisible({ timeout: 60_000 });
  });
});
