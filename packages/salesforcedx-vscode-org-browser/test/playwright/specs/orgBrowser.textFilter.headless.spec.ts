/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  createDreamhouseOrg,
  ensureSecondarySideBarHidden,
  upsertScratchOrgAuthFieldsToSettings,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { test } from '../fixtures';
import { OrgBrowserPage } from '../pages/orgBrowserPage';

test.setTimeout(600_000);

test.beforeEach(async ({ page }) => {
  const createResult = await createDreamhouseOrg();
  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  const orgBrowser = new OrgBrowserPage(page);
  await upsertScratchOrgAuthFieldsToSettings(page, createResult, () => orgBrowser.waitForProject());
  await ensureSecondarySideBarHidden(page);
});

const setFilter = async (browser: OrgBrowserPage, text: string): Promise<void> => {
  await browser.filterInput.fill(text);
  await browser.page.waitForTimeout(200);
};

test('Org Browser - exact type filter and clear', async ({ page }) => {
  const browser = new OrgBrowserPage(page);
  await browser.openOrgBrowser();
  const before = await browser.getStableRootTypeCount();

  await setFilter(browser, 'ApexClass');
  await browser.waitForRootTypeCount(1);
  await expect(browser.sidebar.getByRole('treeitem', { level: 1 })).toHaveAccessibleName('ApexClass');

  await browser.sidebar.getByRole('button', { name: 'Clear filter' }).click();
  await browser.waitForRootTypeCount(before);
});

test('Org Browser - component filter applies to expanded children', async ({ page }) => {
  const browser = new OrgBrowserPage(page);
  await browser.openOrgBrowser();
  await setFilter(browser, 'ApexClass:*Test*');
  await browser.expandFolder('ApexClass');

  const components = browser.sidebar.getByRole('treeitem', { level: 2 });
  await expect(components.first()).toBeVisible({ timeout: 60_000 });
  for (let index = 0; index < (await components.count()); index++) {
    await expect(components.nth(index)).toHaveAccessibleName(/Test/i);
  }
});

test('Org Browser - wildcard type filter', async ({ page }) => {
  const browser = new OrgBrowserPage(page);
  await browser.openOrgBrowser();
  const before = await browser.getStableRootTypeCount();
  await setFilter(browser, 'Apex*');

  const after = await browser.getStableRootTypeCount();
  expect(after).toBeLessThan(before);
  expect(after).toBeGreaterThan(1);
  for (const item of await browser.sidebar.getByRole('treeitem', { level: 1 }).all()) {
    await expect(item).toHaveAccessibleName(/^Apex/);
  }
});

test('Org Browser - regex type filter', async ({ page }) => {
  const browser = new OrgBrowserPage(page);
  await browser.openOrgBrowser();
  await setFilter(browser, '/^(ApexClass|CustomObject)$/');
  await browser.waitForRootTypeCount(2);
});

test('Org Browser - combined type and component wildcard filter', async ({ page }) => {
  const browser = new OrgBrowserPage(page);
  await browser.openOrgBrowser();
  await setFilter(browser, '*Class:*Broker*');

  const types = browser.sidebar.getByRole('treeitem', { level: 1 });
  await expect(types.first()).toBeVisible({ timeout: 60_000 });
  for (const item of await types.all()) await expect(item).toHaveAccessibleName(/Class$/);
});

test('Org Browser - Local and Org toggles compose with text filtering', async ({ page }) => {
  const browser = new OrgBrowserPage(page);
  await browser.openOrgBrowser();
  await browser.showLocalToggle.uncheck();
  await setFilter(browser, 'ApexClass');

  await browser.waitForRootTypeCount(1);
  await expect(browser.sidebar.getByRole('treeitem', { level: 1 })).toHaveAccessibleName('ApexClass');
  await expect(browser.showLocalToggle).not.toBeChecked();
  await expect(browser.showOrgToggle).toBeChecked();
});
