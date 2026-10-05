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

test('Org Browser finds partial file names across metadata types without wildcard syntax', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  await Promise.all([
    orgBrowserPage.applyTextFilter('bRoK'),
    acceptNotification(page, /metadata types matched\. Fetch components for all of them\?/i, 'Yes', {
      timeout: 60_000
    })
  ]);

  const roots = orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 });
  await expect(roots.filter({ hasText: 'CustomObject' }).first()).toBeVisible({ timeout: 120_000 });
  await expect(roots.filter({ hasText: 'CustomTab' }).first()).toBeVisible({ timeout: 120_000 });

  await orgBrowserPage.expandFolder('CustomObject');
  const brokerItems = orgBrowserPage.sidebar.getByRole('treeitem', { name: /Broker__c/i, level: 2 });
  await expect(brokerItems.first()).toBeVisible();

  await orgBrowserPage.expandFolder('CustomTab');
  await expect(brokerItems).toHaveCount(2);
});
