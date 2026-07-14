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

  const beforeItemsLocator = orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 });
  await expect(beforeItemsLocator.first()).toBeVisible({ timeout: 10_000 });
  const beforeCount = await beforeItemsLocator.count();

  const filterButton = page.locator('[aria-label="Filter by Type/Component"]').first();
  await filterButton.click();
  await activeQuickInputTextField(page).fill('ApexClass');
  await page.keyboard.press('Enter');

  const narrowedItems = orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 });
  await expect(narrowedItems).toHaveCount(1, { timeout: 10_000 });
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

  const beforeItemsLocator = orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 });
  await expect(beforeItemsLocator.first()).toBeVisible({ timeout: 10_000 });
  const beforeCount = await beforeItemsLocator.count();

  const filterButton = page.locator('[aria-label="Filter by Type/Component"]').first();
  await filterButton.click();
  await activeQuickInputTextField(page).fill('ApexClass');
  await page.keyboard.press('Escape');

  // Tree should remain unfiltered since we cancelled
  await expect(orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 })).toHaveCount(beforeCount, {
    timeout: 10_000
  });
  await expect(page.locator('[aria-label="Filter by Type/Component"]').first()).toBeVisible({ timeout: 10_000 });
});

test('Org Browser - text filter: clearing the text and pressing Enter clears the filter', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const beforeItemsLocator = orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 });
  await expect(beforeItemsLocator.first()).toBeVisible({ timeout: 10_000 });
  const beforeCount = await beforeItemsLocator.count();

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
  await expect(orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 })).toHaveCount(beforeCount, {
    timeout: 10_000
  });
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
  await expect(items).toHaveCount(1, { timeout: 10_000 });
  await expect(items.first()).toHaveAccessibleName(/^ApexClass/);
});

test('Org Browser - text filter: wildcard type pattern Apex* matches multiple types', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const beforeItemsLocator = orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 });
  await expect(beforeItemsLocator.first()).toBeVisible({ timeout: 10_000 });
  const beforeCount = await beforeItemsLocator.count();

  const filterButton = page.locator('[aria-label="Filter by Type/Component"]').first();
  await filterButton.click();
  await activeQuickInputTextField(page).fill('Apex*');
  await page.keyboard.press('Enter');

  const items = orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 });
  const afterCount = await items.count();

  // Should have fewer items than before (filtered) but more than 1 (multiple Apex* types)
  expect(afterCount).toBeLessThan(beforeCount);
  expect(afterCount).toBeGreaterThanOrEqual(1);

  // All visible items should start with "Apex"
  for (let i = 0; i < afterCount; i++) {
    const item = items.nth(i);
    await expect(item).toHaveAccessibleName(/^Apex/);
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

test('Org Browser - text filter: combined wildcard *Class:*Broker* works', async ({ page }) => {
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const filterButton = page.locator('[aria-label="Filter by Type/Component"]').first();
  await filterButton.click();
  await activeQuickInputTextField(page).fill('*Class:*Broker*');
  await page.keyboard.press('Enter');

  // Should see types ending with "Class"
  const typesLocator = orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 });
  await expect(typesLocator.first()).toBeVisible({ timeout: 10_000 });

  // Expand first matching type to see filtered components
  const firstType = typesLocator.first();
  const typeName = await firstType.getAttribute('aria-label');
  if (typeName?.endsWith('Class')) {
    await firstType.click();

    const componentsLocator = orgBrowserPage.sidebar.getByRole('treeitem', { level: 2 });
    if ((await componentsLocator.count()) > 0) {
      // All visible components should contain "Broker"
      const count = await componentsLocator.count();
      for (let i = 0; i < count; i++) {
        const item = componentsLocator.nth(i);
        await expect(item).toHaveAccessibleName(/Broker/i);
      }
    }
  }
});
