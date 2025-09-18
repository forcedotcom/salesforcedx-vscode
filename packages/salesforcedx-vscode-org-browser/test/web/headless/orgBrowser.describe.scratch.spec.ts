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

test.describe('Org Browser high-level validation', () => {
  test.setTimeout(10 * 60 * 1000);

  let tmpRoot: string | undefined;
  let createdScratch = false;

  test.beforeEach(async ({ browser, page }) => {
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

  test('a few types from describe and a basic metadata list (custom tab) ', async ({ page }) => {
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
      await expect(tabType).toHaveScreenshot('customtab-found.png');
    });

    await test.step('CustomTab expanded with child UI', async () => {
      await orgBrowserPage.expandFolder(tabType);
      const tabItem = await orgBrowserPage.getMetadataItem('CustomTab', 'Broker__c');
      // screenshot includes the non-filled circle
      await expect(tabItem).toHaveScreenshot('customtab-broker__c.png');
    });
  });
});
