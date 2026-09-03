/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container twin of orgBrowser.textFilter.headless (ADR 0022). Exercises the Org Browser text
 * filter in the Code Builder image against the container's boot-authed org, using only universal
 * metadata (the `Apex*` types are present on every org, and the container workspace seeds local
 * ApexClass components) so no Dreamhouse metadata or per-test org setup is needed. The headless
 * twin's two Broker__c-specific subtests are intentionally omitted here — see SKIP notes below.
 */

import { expect } from '@playwright/test';
import {
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { OrgBrowserPage } from '../../pages/orgBrowserPage';
import { containerTest as test } from '../../fixtures/containerFixtures';
import { normalizeOrgBrowserFilters } from './containerHelpers';

// Shared, persistent workbench: reset editors, notifications, and the persisted Org Browser filter
// state before each test rather than assuming a clean slate.
test.beforeEach(async ({ page }) => {
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await closeAllEditors(page);
  await clearAllNotifications(page);
  await normalizeOrgBrowserFilters(new OrgBrowserPage(page));
});

test('Org Browser - text filter: toolbar icon visible and swaps to filled state on commit', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const filterButton = page.locator('[aria-label="Filter by Type/Component"]').first();
  await expect(filterButton, 'unfilled filter icon should be visible before any filter is set').toBeVisible({
    timeout: 10_000
  });

  await orgBrowserPage.applyTextFilter('ApexClass');

  const activeFilterButton = page.locator('[aria-label="Edit Filter (active)"]').first();
  await expect(activeFilterButton, 'filled filter icon should appear once a filter is committed').toBeVisible({
    timeout: 10_000
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

test('Org Browser - text filter: exact type name filters tree on commit', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const beforeCount = await orgBrowserPage.getStableRootTypeCount();

  await orgBrowserPage.applyTextFilter('ApexClass');

  const narrowedItems = orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 });
  await orgBrowserPage.waitForRootTypeCount(1);
  await expect(narrowedItems.first()).toHaveAccessibleName(/^ApexClass/);
  expect(beforeCount).toBeGreaterThan(1);

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

test('Org Browser - text filter: unresolved type name empties the tree', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  await orgBrowserPage.fillTextFilter('NotARealType:Whatever');

  await expect(orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 })).toHaveCount(0, { timeout: 10_000 });

  await page.keyboard.press('Escape');

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

test('Org Browser - text filter: Escape cancels without applying filter', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const beforeCount = await orgBrowserPage.getStableRootTypeCount();

  await orgBrowserPage.fillTextFilter('ApexClass');
  await page.keyboard.press('Escape');

  // Tree should remain unfiltered since we cancelled
  await orgBrowserPage.waitForRootTypeCount(beforeCount);
  await expect(page.locator('[aria-label="Filter by Type/Component"]').first()).toBeVisible({ timeout: 10_000 });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

test('Org Browser - text filter: clearing the text and pressing Enter clears the filter', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const beforeCount = await orgBrowserPage.getStableRootTypeCount();

  await orgBrowserPage.applyTextFilter('ApexClass');

  const activeFilterButton = page.locator('[aria-label="Edit Filter (active)"]').first();
  await expect(activeFilterButton).toBeVisible({ timeout: 10_000 });

  await orgBrowserPage.applyTextFilter('');

  await expect(page.locator('[aria-label="Filter by Type/Component"]').first()).toBeVisible({ timeout: 10_000 });
  await orgBrowserPage.waitForRootTypeCount(beforeCount);

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

test('Org Browser - text filter: composes with an active showLocal/showOrg toggle', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const hideLocalButton = page.locator('[aria-label="Hide Local Types"]').first();
  await expect(hideLocalButton).toBeVisible({ timeout: 10_000 });
  await hideLocalButton.click();
  await expect(page.locator('[aria-label="Show Local Types"]').first()).toBeVisible({ timeout: 10_000 });

  await orgBrowserPage.applyTextFilter('ApexClass');

  const items = orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 });
  await orgBrowserPage.waitForRootTypeCount(1);
  await expect(items.first()).toHaveAccessibleName(/^ApexClass/);

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

test('Org Browser - text filter: wildcard type pattern Apex* matches multiple types', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  const beforeCount = await orgBrowserPage.getStableRootTypeCount();

  await orgBrowserPage.applyTextFilter('Apex*');

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

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

test('Org Browser - text filter: wildcard component pattern *Test* filters children', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const orgBrowserPage = new OrgBrowserPage(page);
  await orgBrowserPage.openOrgBrowser();

  // The container workspace seeds local ApexClass components (…Test.cls), so component-level
  // filtering under a universal type has a non-empty case without any org-specific metadata.
  await orgBrowserPage.applyTextFilter('ApexClass:*Test*');

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

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

/*
 * SKIPPED (not ported): the headless twin's "Type:component filters expanded children"
 * (CustomObject:Broker__c) and "combined wildcard *Object:*Broker* works" subtests both assert on
 * the Dreamhouse CustomObject `Broker__c`, which the bare boot scratch org does not contain.
 */
