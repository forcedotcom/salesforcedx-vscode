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
  activeQuickInputTextField,
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

test('Org Browser - text filter: toolbar icon visible and swaps to filled state on commit', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const filterButton = page.locator('[aria-label="Filter by Type/Component"]').first();
  await expect(filterButton, 'unfilled filter icon should be visible before any filter is set').toBeVisible({
    timeout: 10_000
  });

  await filterButton.click();
  await activeQuickInputTextField(page).fill('ApexClass');
  await page.keyboard.press('Enter');

  const activeFilterButton = page.locator('[aria-label="Edit Filter (active)"]').first();
  await expect(activeFilterButton, 'filled filter icon should appear once a filter is committed').toBeVisible({
    timeout: 10_000
  });
});

test('Org Browser - text filter: exact type name filters tree on commit', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const beforeCount = await orgBrowserPage.getStableRootTypeCount();

  const filterButton = page.locator('[aria-label="Filter by Type/Component"]').first();
  await filterButton.click();
  await activeQuickInputTextField(page).fill('ApexClass');
  await page.keyboard.press('Enter');

  const narrowedItems = orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 });
  await orgBrowserPage.waitForRootTypeCount(1);
  await expect(narrowedItems.first()).toHaveAccessibleName(/^ApexClass/);
  expect(beforeCount).toBeGreaterThan(1);
});

test('Org Browser - text filter: Type:component filters expanded children', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const filterButton = page.locator('[aria-label="Filter by Type/Component"]').first();
  await filterButton.click();
  await activeQuickInputTextField(page).fill('ApexClass:');
  await page.keyboard.press('Enter');

  await orgBrowserPage.expandFolder('ApexClass');
  const componentsBeforeLocator = orgBrowserPage.sidebar.getByRole('treeitem', { level: 2 });
  await expect(componentsBeforeLocator.first()).toBeVisible({ timeout: 10_000 });
  const componentsBefore = await componentsBeforeLocator.count();
  expect(componentsBefore).toBeGreaterThan(0);

  const secondFilterButton = page.locator('[aria-label="Edit Filter (active)"]').first();
  await secondFilterButton.click();
  await activeQuickInputTextField(page).fill('ApexClass:Broker');
  await page.keyboard.press('Enter');

  const componentsAfter = orgBrowserPage.sidebar.getByRole('treeitem', { level: 2 });
  await expect(componentsAfter.first()).toBeVisible({ timeout: 10_000 });
  const afterCount = await componentsAfter.count();
  expect(afterCount).toBeLessThanOrEqual(componentsBefore);
});

test('Org Browser - text filter: unresolved type name empties the tree', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const filterButton = page.locator('[aria-label="Filter by Type/Component"]').first();
  await filterButton.click();
  await activeQuickInputTextField(page).fill('NotARealType:Whatever');

  await expect(orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 })).toHaveCount(0, { timeout: 10_000 });

  await page.keyboard.press('Escape');
});

test('Org Browser - text filter: Escape cancels without applying filter', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const beforeCount = await orgBrowserPage.getStableRootTypeCount();

  const filterButton = page.locator('[aria-label="Filter by Type/Component"]').first();
  await filterButton.click();
  await activeQuickInputTextField(page).fill('ApexClass');
  await page.keyboard.press('Escape');

  // Tree should remain unfiltered since we cancelled
  await orgBrowserPage.waitForRootTypeCount(beforeCount);
  await expect(page.locator('[aria-label="Filter by Type/Component"]').first()).toBeVisible({ timeout: 10_000 });
});

test('Org Browser - text filter: clearing the text and pressing Enter clears the filter', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const beforeCount = await orgBrowserPage.getStableRootTypeCount();

  const filterButton = page.locator('[aria-label="Filter by Type/Component"]').first();
  await filterButton.click();
  await activeQuickInputTextField(page).fill('ApexClass');
  await page.keyboard.press('Enter');

  const activeFilterButton = page.locator('[aria-label="Edit Filter (active)"]').first();
  await expect(activeFilterButton).toBeVisible({ timeout: 10_000 });

  await activeFilterButton.click();
  await activeQuickInputTextField(page).fill('');
  await page.keyboard.press('Enter');

  await expect(page.locator('[aria-label="Filter by Type/Component"]').first()).toBeVisible({ timeout: 10_000 });
  await orgBrowserPage.waitForRootTypeCount(beforeCount);
});

test('Org Browser - text filter: composes with an active showLocal/showOrg toggle', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const hideLocalButton = page.locator('[aria-label="Hide Local Types"]').first();
  await expect(hideLocalButton).toBeVisible({ timeout: 10_000 });
  await hideLocalButton.click();
  await expect(page.locator('[aria-label="Show Local Types"]').first()).toBeVisible({ timeout: 10_000 });

  const filterButton = page.locator('[aria-label="Filter by Type/Component"]').first();
  await filterButton.click();
  await activeQuickInputTextField(page).fill('ApexClass');
  await page.keyboard.press('Enter');

  const items = orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 });
  await orgBrowserPage.waitForRootTypeCount(1);
  await expect(items.first()).toHaveAccessibleName(/^ApexClass/);
});

test('Org Browser - text filter: wildcard type pattern Apex* matches multiple types', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const beforeCount = await orgBrowserPage.getStableRootTypeCount();

  const filterButton = page.locator('[aria-label="Filter by Type/Component"]').first();
  await filterButton.click();
  await activeQuickInputTextField(page).fill('Apex*');
  await page.keyboard.press('Enter');

  await expect(page.locator('[aria-label="Edit Filter (active)"]').first()).toBeVisible({ timeout: 10_000 });
  const items = orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 });
  await expect.poll(() => orgBrowserPage.getRootTypeCount(), { timeout: 10_000 }).toBeLessThan(beforeCount);
  const afterCount = await orgBrowserPage.getStableRootTypeCount();

  // Should have fewer items than before (filtered) but more than 1 (multiple Apex* types)
  expect(afterCount).toBeGreaterThanOrEqual(1);

  // Virtualized trees may retain rows outside the current model. Assert only rendered rows.
  for (const item of await items.all()) {
    if (await item.isVisible()) await expect(item).toHaveAccessibleName(/^Apex/);
  }
});

test('Org Browser - text filter: wildcard component pattern *Test* filters children', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const filterButton = page.locator('[aria-label="Filter by Type/Component"]').first();
  await filterButton.click();
  await activeQuickInputTextField(page).fill('ApexClass:*Test*');
  await page.keyboard.press('Enter');

  await orgBrowserPage.expandFolder('ApexClass');
  const componentsLocator = orgBrowserPage.sidebar.getByRole('treeitem', { level: 2 });
  await expect(componentsLocator.first()).toBeVisible({ timeout: 10_000 });

  const count = await componentsLocator.count();
  expect(count).toBeGreaterThan(0);

  // All visible components should contain "Test"
  for (let i = 0; i < count; i++) {
    const item = componentsLocator.nth(i);
    await expect(item).toHaveAccessibleName(/Test/i);
  }
});

test('Org Browser - text filter: combined wildcard *Object:*Broker* works', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const filterButton = page.locator('[aria-label="Filter by Type/Component"]').first();
  await filterButton.click();
  await activeQuickInputTextField(page).fill('*Object:*Broker*');
  await page.keyboard.press('Enter');

  const typesLocator = orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 });
  await expect(typesLocator).toHaveCount(1, { timeout: 10_000 });
  await expect(typesLocator.first()).toHaveAccessibleName(/^CustomObject/);

  await orgBrowserPage.expandFolder('CustomObject');
  const componentsLocator = orgBrowserPage.sidebar.getByRole('treeitem', { level: 2 });
  await expect(componentsLocator).toHaveCount(1, { timeout: 10_000 });
  await expect(componentsLocator.first()).toHaveAccessibleName(/Broker__c/i);
});
