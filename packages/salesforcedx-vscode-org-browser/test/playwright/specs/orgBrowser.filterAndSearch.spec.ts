/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { test } from '../fixtures';
import { expect } from '@playwright/test';
import { OrgBrowserPage } from '../pages/orgBrowserPage';
import { upsertScratchOrgAuthFieldsToSettings } from '../pages/settings';
import { create } from '../utils/dreamhouseScratchOrgSetup';
import { waitForRetrieveProgressNotificationToAppear } from '../pages/notifications';

test.describe('Org Browser - Filter and Search Functionality', () => {
  test.setTimeout(10 * 60 * 1000);

  test.beforeEach(async ({ page }) => {
    const createResult = await create();
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
  });

  test.describe('Filter Functionality', () => {
    test('show local only filter - toggle on and off', async ({ page }) => {
      const orgBrowserPage = new OrgBrowserPage(page);

      await test.step('open org browser', async () => {
        await orgBrowserPage.openOrgBrowser();
      });

      await test.step('expand CustomObject type', async () => {
        const customObjectType = await orgBrowserPage.findMetadataType('CustomObject');
        await customObjectType.hover();
        await orgBrowserPage.expandFolder('CustomObject');
      });

      await test.step('count initial metadata items', async () => {
        // Wait for items to load
        await expect(
          orgBrowserPage.sidebar.getByRole('treeitem', { level: 2 }).nth(0),
          'CustomObject items should be visible'
        ).toBeVisible({ timeout: 30_000 });

        // Count items before filter
        const initialCount = await orgBrowserPage.sidebar.getByRole('treeitem', { level: 2 }).count();
        expect(initialCount, 'Should have multiple CustomObject items').toBeGreaterThan(5);
      });

      let brokerItem: any;
      await test.step('retrieve one item (Broker__c) to create local file', async () => {
        brokerItem = await orgBrowserPage.getMetadataItem('CustomObject', 'Broker__c');
        await brokerItem.hover();

        const clicked = await orgBrowserPage.clickRetrieveButton(brokerItem);
        expect(clicked).toBe(true);

        await waitForRetrieveProgressNotificationToAppear(page, 60_000);
        await orgBrowserPage.waitForFileToOpenInEditor(120_000);
      });

      await test.step('verify Broker__c has local file indicator', async () => {
        // Re-find the item after retrieval
        brokerItem = await orgBrowserPage.getMetadataItem('CustomObject', 'Broker__c');
        const hasLocal = await orgBrowserPage.hasFilePresenceIndicator(brokerItem);
        expect(hasLocal, 'Broker__c should have local file indicator').toBe(true);
      });

      await test.step('toggle show local only filter on', async () => {
        await orgBrowserPage.toggleShowLocalOnly();
      });

      await test.step('verify tree message shows filter state', async () => {
        const message = await orgBrowserPage.getTreeViewMessage();
        expect(message, 'Tree message should indicate local-only filter').toContain('Local files only');
      });

      await test.step('verify only local items are visible', async () => {
        // Wait a moment for filter to apply
        await page.waitForTimeout(1000);

        // Count items after filter - should be fewer
        const filteredCount = await orgBrowserPage.sidebar.getByRole('treeitem', { level: 2 }).count();
        expect(filteredCount, 'Should have fewer items when filtered').toBeLessThan(5);

        // Broker__c should still be visible
        brokerItem = await orgBrowserPage.getMetadataItem('CustomObject', 'Broker__c');
        await expect(brokerItem).toBeVisible();
      });

      await test.step('toggle show local only filter off', async () => {
        await orgBrowserPage.toggleShowLocalOnly();
      });

      await test.step('verify all items return', async () => {
        // Wait a moment for filter to clear
        await page.waitForTimeout(1000);

        const finalCount = await orgBrowserPage.sidebar.getByRole('treeitem', { level: 2 }).count();
        expect(finalCount, 'All items should return after filter is off').toBeGreaterThan(5);
      });

      await test.step('verify tree message is cleared', async () => {
        const message = await orgBrowserPage.getTreeViewMessage();
        expect(message, 'Tree message should not show filter when off').not.toContain('Local files only');
      });
    });

    test('hide managed packages filter - toggle on and off', async ({ page }) => {
      const orgBrowserPage = new OrgBrowserPage(page);

      await test.step('open org browser', async () => {
        await orgBrowserPage.openOrgBrowser();
      });

      await test.step('count initial metadata types', async () => {
        // Count all metadata types before filter
        const initialCount = await orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 }).count();
        expect(initialCount, 'Should have many metadata types').toBeGreaterThan(10);
      });

      await test.step('toggle hide managed filter on', async () => {
        await orgBrowserPage.toggleHideManaged();
      });

      await test.step('verify tree message shows filter state', async () => {
        const message = await orgBrowserPage.getTreeViewMessage();
        expect(message, 'Tree message should indicate hide managed filter').toContain('Hiding managed packages');
      });

      await test.step('verify filter is active', async () => {
        // Wait a moment for filter to apply
        await page.waitForTimeout(1000);

        // The count may or may not change depending on whether there are managed packages
        // But the filter should be active (indicated by the message)
        const message = await orgBrowserPage.getTreeViewMessage();
        expect(message).toContain('Hiding managed packages');
      });

      await test.step('toggle hide managed filter off', async () => {
        await orgBrowserPage.toggleHideManaged();
      });

      await test.step('verify tree message is cleared', async () => {
        const message = await orgBrowserPage.getTreeViewMessage();
        expect(message, 'Tree message should not show filter when off').not.toContain('Hiding managed packages');
      });
    });

    test('combined filters - both local only and hide managed', async ({ page }) => {
      const orgBrowserPage = new OrgBrowserPage(page);

      await test.step('open org browser', async () => {
        await orgBrowserPage.openOrgBrowser();
      });

      await test.step('expand CustomObject and retrieve one item', async () => {
        const customObjectType = await orgBrowserPage.findMetadataType('CustomObject');
        await customObjectType.hover();
        await orgBrowserPage.expandFolder('CustomObject');

        const brokerItem = await orgBrowserPage.getMetadataItem('CustomObject', 'Broker__c');
        await brokerItem.hover();

        const clicked = await orgBrowserPage.clickRetrieveButton(brokerItem);
        expect(clicked).toBe(true);

        await waitForRetrieveProgressNotificationToAppear(page, 60_000);
        await orgBrowserPage.waitForFileToOpenInEditor(120_000);
      });

      await test.step('enable both filters', async () => {
        await orgBrowserPage.toggleShowLocalOnly();
        await page.waitForTimeout(500);
        await orgBrowserPage.toggleHideManaged();
        await page.waitForTimeout(500);
      });

      await test.step('verify tree message shows both filters', async () => {
        const message = await orgBrowserPage.getTreeViewMessage();
        expect(message, 'Tree message should show both filters').toContain('Local files only');
        expect(message, 'Tree message should show both filters').toContain('Hiding managed packages');
        expect(message, 'Filters should be separated by pipe').toContain('|');
      });

      await test.step('verify filtered tree is functional', async () => {
        // Should still be able to navigate and see local items
        const brokerItem = await orgBrowserPage.getMetadataItem('CustomObject', 'Broker__c');
        await expect(brokerItem).toBeVisible();
      });

      await test.step('disable both filters', async () => {
        await orgBrowserPage.toggleShowLocalOnly();
        await page.waitForTimeout(500);
        await orgBrowserPage.toggleHideManaged();
        await page.waitForTimeout(500);
      });

      await test.step('verify tree message is cleared', async () => {
        const message = await orgBrowserPage.getTreeViewMessage();
        if (message) {
          expect(message, 'Tree message should not show filters when off').not.toContain('Local files only');
          expect(message, 'Tree message should not show filters when off').not.toContain('Hiding managed packages');
        }
      });
    });
  });

  test.describe('Search Functionality', () => {
    test('search metadata types by name', async ({ page }) => {
      const orgBrowserPage = new OrgBrowserPage(page);

      await test.step('open org browser', async () => {
        await orgBrowserPage.openOrgBrowser();
      });

      await test.step('count all metadata types before search', async () => {
        const initialCount = await orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 }).count();
        expect(initialCount, 'Should have many metadata types').toBeGreaterThan(20);
      });

      await test.step('search for "Custom" metadata types', async () => {
        await orgBrowserPage.search('Custom');
      });

      await test.step('verify tree message shows search query', async () => {
        const message = await orgBrowserPage.getTreeViewMessage();
        expect(message, 'Tree message should show search query').toContain('Searching:');
        expect(message, 'Tree message should show search query').toContain('Custom');
      });

      await test.step('verify only matching types are visible', async () => {
        // Wait for search to apply
        await page.waitForTimeout(1000);

        const filteredCount = await orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 }).count();
        expect(filteredCount, 'Should have fewer types after search').toBeLessThan(10);

        // CustomObject should be visible
        const customObject = await orgBrowserPage.findMetadataType('CustomObject');
        await expect(customObject).toBeVisible();

        // CustomTab should be visible
        const customTab = await orgBrowserPage.findMetadataType('CustomTab');
        await expect(customTab).toBeVisible();
      });

      await test.step('clear search', async () => {
        await orgBrowserPage.clearSearch();
      });

      await test.step('verify all types return after clearing search', async () => {
        // Wait for search to clear
        await page.waitForTimeout(1000);

        const finalCount = await orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 }).count();
        expect(finalCount, 'All types should return after clearing search').toBeGreaterThan(20);
      });

      await test.step('verify tree message is cleared', async () => {
        const message = await orgBrowserPage.getTreeViewMessage();
        if (message) {
          expect(message, 'Tree message should not show search when cleared').not.toContain('Searching:');
        }
      });
    });

    test('search metadata items within expanded type', async ({ page }) => {
      const orgBrowserPage = new OrgBrowserPage(page);

      await test.step('open org browser', async () => {
        await orgBrowserPage.openOrgBrowser();
      });

      await test.step('expand CustomObject type', async () => {
        const customObjectType = await orgBrowserPage.findMetadataType('CustomObject');
        await customObjectType.hover();
        await orgBrowserPage.expandFolder('CustomObject');
      });

      await test.step('count items before search', async () => {
        await expect(
          orgBrowserPage.sidebar.getByRole('treeitem', { level: 2 }).nth(0),
          'CustomObject items should be visible'
        ).toBeVisible({ timeout: 30_000 });

        const initialCount = await orgBrowserPage.sidebar.getByRole('treeitem', { level: 2 }).count();
        expect(initialCount, 'Should have multiple items').toBeGreaterThan(5);
      });

      await test.step('search for "Broker"', async () => {
        await orgBrowserPage.search('Broker');
      });

      await test.step('verify tree message shows search', async () => {
        const message = await orgBrowserPage.getTreeViewMessage();
        expect(message, 'Tree message should show search query').toContain('Searching:');
        expect(message, 'Tree message should show search query').toContain('Broker');
      });

      await test.step('verify only matching items are visible', async () => {
        // Wait for search to apply
        await page.waitForTimeout(1000);

        const filteredCount = await orgBrowserPage.sidebar.getByRole('treeitem', { level: 2 }).count();
        expect(filteredCount, 'Should have fewer items after search').toBeLessThan(5);

        // Broker__c should be visible
        const brokerItem = await orgBrowserPage.getMetadataItem('CustomObject', 'Broker__c');
        await expect(brokerItem).toBeVisible();
      });

      await test.step('clear search and verify items return', async () => {
        await orgBrowserPage.clearSearch();
        await page.waitForTimeout(1000);

        const finalCount = await orgBrowserPage.sidebar.getByRole('treeitem', { level: 2 }).count();
        expect(finalCount, 'All items should return').toBeGreaterThan(5);
      });
    });

    test('search combined with show local only filter', async ({ page }) => {
      const orgBrowserPage = new OrgBrowserPage(page);

      await test.step('open org browser', async () => {
        await orgBrowserPage.openOrgBrowser();
      });

      await test.step('expand CustomObject and retrieve Broker__c', async () => {
        const customObjectType = await orgBrowserPage.findMetadataType('CustomObject');
        await customObjectType.hover();
        await orgBrowserPage.expandFolder('CustomObject');

        const brokerItem = await orgBrowserPage.getMetadataItem('CustomObject', 'Broker__c');
        await brokerItem.hover();

        const clicked = await orgBrowserPage.clickRetrieveButton(brokerItem);
        expect(clicked).toBe(true);

        // Wait for retrieval to complete
        await page.waitForTimeout(5000);
      });

      await test.step('enable show local only filter', async () => {
        await orgBrowserPage.toggleShowLocalOnly();
        await page.waitForTimeout(500);
      });

      await test.step('search for "Custom"', async () => {
        await orgBrowserPage.search('Custom');
        await page.waitForTimeout(500);
      });

      await test.step('verify tree message shows both search and filter', async () => {
        const message = await orgBrowserPage.getTreeViewMessage();
        expect(message, 'Should show search query').toContain('Searching:');
        expect(message, 'Should show search query').toContain('Custom');
        expect(message, 'Should show local filter').toContain('Local files only');
      });

      await test.step('verify combined filtering works', async () => {
        // CustomObject should be visible (matches "Custom" and has local items)
        const customObject = await orgBrowserPage.findMetadataType('CustomObject');
        await expect(customObject).toBeVisible();

        // When expanded, should only show local items
        await orgBrowserPage.expandFolder('CustomObject');
        const brokerItem = await orgBrowserPage.getMetadataItem('CustomObject', 'Broker__c');
        await expect(brokerItem).toBeVisible();
      });

      await test.step('clear search and filter', async () => {
        await orgBrowserPage.clearSearch();
        await page.waitForTimeout(500);
        await orgBrowserPage.toggleShowLocalOnly();
        await page.waitForTimeout(500);
      });

      await test.step('verify tree returns to normal', async () => {
        const message = await orgBrowserPage.getTreeViewMessage();
        if (message) {
          expect(message, 'Should not show search').not.toContain('Searching:');
          expect(message, 'Should not show filter').not.toContain('Local files only');
        }
      });
    });

    test('empty search results', async ({ page }) => {
      const orgBrowserPage = new OrgBrowserPage(page);

      await test.step('open org browser', async () => {
        await orgBrowserPage.openOrgBrowser();
      });

      await test.step('search for non-existent metadata type', async () => {
        await orgBrowserPage.search('NonExistentMetadataType12345');
      });

      await test.step('verify tree message shows search', async () => {
        const message = await orgBrowserPage.getTreeViewMessage();
        expect(message, 'Tree message should show search query').toContain('Searching:');
      });

      await test.step('verify no items are visible or appropriate message shown', async () => {
        // Wait for search to apply
        await page.waitForTimeout(1000);

        // Either no items are visible, or a "no results" message is shown
        const itemCount = await orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 }).count();
        expect(itemCount, 'Should have no or very few items').toBeLessThanOrEqual(1);
      });

      await test.step('clear search and verify items return', async () => {
        await orgBrowserPage.clearSearch();
        await page.waitForTimeout(1000);

        const finalCount = await orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 }).count();
        expect(finalCount, 'All types should return').toBeGreaterThan(20);
      });
    });
  });
});
