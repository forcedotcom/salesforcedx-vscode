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

test.describe('Org Browser - CustomObject retrieval (headless)', () => {
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

  test('customobject headless: retrieve Broker__c', async ({ page }) => {
    const orgBrowserPage = new OrgBrowserPage(page);

    await test.step('open Org Browser', async () => {
      await orgBrowserPage.openOrgBrowser();
    });

    const customObjectType = await test.step('find CustomObject type', async () => {
      const locator = await orgBrowserPage.findMetadataType('CustomObject');
      await locator.hover({ timeout: 500 });
      await expect(locator).toMatchAriaSnapshot({ name: 'customobject-found' });
      return locator;
    });

    const brokerItem = await test.step('expand CustomObject and locate Broker__c', async () => {
      await orgBrowserPage.expandFolder(customObjectType);
      const item = await orgBrowserPage.getMetadataItem('CustomObject', 'Broker__c');
      await item.hover({ timeout: 500 });
      await expect(item).toMatchAriaSnapshot({ name: 'customobject-broker__c' });
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
