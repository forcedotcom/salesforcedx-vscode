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
  acceptNotification,
  closeWelcomeTabs,
  createDreamhouseOrg,
  ensureSecondarySideBarHidden,
  upsertScratchOrgAuthFieldsToSettings,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';

test.setTimeout(600_000);

test.beforeEach(async ({ page }) => {
  const createResult = await createDreamhouseOrg();
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  const orgBrowserPage = new OrgBrowserPage(page);
  await upsertScratchOrgAuthFieldsToSettings(page, createResult, () => orgBrowserPage.waitForProject());
  await ensureSecondarySideBarHidden(page);
});

test('Org Browser retains an expanded custom object when a plain search matches one of its fields', async ({
  page
}) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  await orgBrowserPage.applyTextFilter('CustomObject:');
  await acceptNotification(page, /Search all \d+ metadata types in the org\?/, 'Use Loaded Results');
  const customObjects = orgBrowserPage.sidebar.getByRole('treeitem', { name: /^CustomObject(,|$)/, level: 1 });
  await expect(customObjects).toBeVisible();
  await customObjects.locator('.monaco-tl-twistie').click();
  await orgBrowserPage.getMetadataItem('CustomObject', 'Broker__c');
  await orgBrowserPage.getMetadataItem('Broker__c', 'Email__c', 3);
  await orgBrowserPage.applyTextFilter('Email');

  await expect(orgBrowserPage.sidebar.getByRole('treeitem', { name: /CustomObject/i, level: 1 })).toBeVisible();
  await expect(orgBrowserPage.sidebar.getByRole('treeitem', { name: /Broker__c/i, level: 2 })).toBeVisible();
  await expect(orgBrowserPage.sidebar.getByRole('treeitem', { name: /Email/i, level: 3 })).toBeVisible();
});
