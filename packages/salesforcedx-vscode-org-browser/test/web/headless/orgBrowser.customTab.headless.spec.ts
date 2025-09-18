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

test.describe('Org Browser - CustomTab retrieval (headless)', () => {
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

  test('custom-tab headless: retrieve Broker__c tab', async ({ page }) => {
    const orgBrowserPage = new OrgBrowserPage(page);

    await test.step('open Org Browser', async () => {
      await orgBrowserPage.openOrgBrowser();
      // Guard: ensure enough top-level items exist before type-to-search (findMetadataType hovers nth(5))
      await page.locator('[role="treeitem"][aria-level="1"]').nth(5).waitFor({ timeout: 15000 });
    });

    const customTabType = await test.step('find CustomTab type', async () => {
      const locator = await orgBrowserPage.findMetadataType('CustomTab');
      await expect(locator).toHaveScreenshot('customtab-found.png');
      return locator;
    });

    const brokerItem = await test.step('expand CustomTab and locate Broker__c', async () => {
      await orgBrowserPage.expandFolder(customTabType);
      const item = await orgBrowserPage.getMetadataItem('CustomTab', 'Broker__c');
      await expect(item).toHaveScreenshot('customtab-broker__c.png');
      return item;
    });

    await test.step('trigger retrieval', async () => {
      const clicked = await orgBrowserPage.clickRetrieveButton(brokerItem);
      expect(clicked).toBe(true);
    });

    await test.step('wait for retrieval progress to appear', async () => {
      await orgBrowserPage.waitForRetrieveProgressNotificationToAppear(60_000);
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
      await expect(brokerTab).toHaveScreenshot('customtab-broker__c-editor.png');
    });

    await test.step('visual assertion: Broker__c shows filled circle', async () => {
      // move mouse away to avoid hover visuals
      await page.mouse.move(0, 0);
      await expect(brokerItem).toHaveScreenshot('customtab-broker__c-filled.png');
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
      await orgBrowserPage.clickRetrieveButton(customTabType);
      await orgBrowserPage.waitForRetrieveProgressNotificationToAppear(60_000);
    });
  });
});
