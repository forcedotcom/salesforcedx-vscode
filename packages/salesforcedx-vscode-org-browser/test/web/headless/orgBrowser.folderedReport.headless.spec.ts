/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { test, expect } from '@playwright/test';
import * as fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { OrgBrowserPage } from '../pages/orgBrowserPage';
import { upsertScratchOrgAuthFieldsToSettings } from '../pages/Settings';
import { create } from '../utils/dreamhouseScratchOrgSetup';

const execAsync = promisify(exec);

/** Headless-like test for foldered Report retrieval */
test.describe('Org Browser - Foldered Report retrieval (headless)', () => {
  test.setTimeout(10 * 60 * 1000);

  let tmpRoot: string | undefined;
  let createdScratch = false;

  test.beforeEach(async ({ page }) => {
    const createResult = await create();
    const { accessToken, instanceUrl, instanceApiVersion } = createResult;
    const authFields = { accessToken, instanceUrl, instanceApiVersion };
    tmpRoot = createResult.tmpRoot;
    createdScratch = createResult.createdScratch === true;

    await upsertScratchOrgAuthFieldsToSettings(page, authFields);
  });

  test.afterAll(async () => {
    if (createdScratch) {
      await execAsync('sf org delete scratch -o dreamhouse --no-prompt').catch(() => undefined);
    }
    if (tmpRoot) {
      await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => undefined);
    }
  });

  test('foldered report headless: retrieve flow_orchestration_log from unfiled$public', async ({ page }) => {
    const orgBrowserPage = new OrgBrowserPage(page);
    let reportName: string | undefined;

    await test.step('open Org Browser', async () => {
      await orgBrowserPage.openOrgBrowser();
    });

    const reportType = await test.step('find Report type', async () => {
      const locator = await orgBrowserPage.findMetadataType('Report');
      await locator.hover({ timeout: 500 });
      await expect(locator).toMatchAriaSnapshot({ name: 'report-found' });
      return locator;
    });

    const folderName = 'unfiled$public';

    const reportFolder = await test.step('expand Report and locate unfiled$public folder', async () => {
      await orgBrowserPage.expandFolder(reportType);
      const folder = await orgBrowserPage.getMetadataItem('Report', folderName, 2);
      await expect(folder).toBeVisible();
      await orgBrowserPage.expandFolder(folder);
      return folder;
    });

    const reportItem = await test.step('locate first report item in folder', async () => {
      const level3 = page.locator('[role="treeitem"][aria-level="3"]').first();
      await expect(level3).toBeVisible({ timeout: 15000 });
      const txt = (await level3.textContent())?.trim() ?? '';
      reportName = txt.split('/').pop();
      await level3.hover({ timeout: 500 });
      await expect(level3).toMatchAriaSnapshot({ name: 'report-first-item' });
      return level3;
    });

    await test.step('verify retrieve is not available at type/folder levels', async () => {
      await reportType.hover();
      await expect(reportType.locator('.action-label[aria-label="Retrieve Metadata"]')).toBeHidden();
      await reportFolder.hover();
      await expect(reportFolder.locator('.action-label[aria-label="Retrieve Metadata"]')).toBeHidden();
    });

    await test.step('trigger retrieval on a single report', async () => {
      const clicked = await orgBrowserPage.clickRetrieveButton(reportItem);
      expect(clicked).toBe(true);
    });

    await test.step('wait for retrieval progress to appear', async () => {
      await orgBrowserPage.waitForRetrieveProgressNotificationToAppear(60_000);
    });

    await test.step('wait for editor file to open (completion signal)', async () => {
      const fileOpened = await orgBrowserPage.waitForFileToOpenInEditor(120_000);
      expect(fileOpened).toBe(true);
    });

    await test.step('verify editor shows the report tab and capture', async () => {
      const editorPart = page.locator('#workbench\\.parts\\.editor');
      await expect(editorPart).toBeVisible();
      const safeName = (reportName ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reportTab = page.getByRole('tab', { name: new RegExp(safeName, 'i') }).first();
      await expect(reportTab).toBeVisible();
      await expect(reportTab).toMatchAriaSnapshot({ name: 'report-editor-tab' });
    });

    await test.step('override confirmation for a single report', async () => {
      await orgBrowserPage.clickRetrieveButton(reportItem);

      const overwrite = page
        .locator('.monaco-workbench .notification-list-item')
        .filter({ hasText: /Overwrite\s+local\s+files\s+for/i })
        .first();
      await expect(overwrite).toBeVisible();
      await expect(overwrite).toContainText(/Overwrite\s+local\s+files\s+for\s+\d+\s+Report\s*\?/i);

      await overwrite.getByRole('button', { name: /^Yes$/ }).click();

      const retrieving = page
        .locator('.monaco-workbench .notification-list-item')
        .filter({ hasText: /Retrieving\s+Report/i })
        .first();
      await expect(retrieving).toBeVisible({ timeout: 60_000 });
    });
  });
});
