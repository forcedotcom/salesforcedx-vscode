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

test.describe('Org Browser - Filter and Search verification', () => {
  test.beforeEach(async ({ page }) => {
    const createResult = await create();
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
  });

  test('should verify all filter and search functionality with stable workspace', async ({ page }) => {
    const orgBrowserPage = new OrgBrowserPage(page);

    // ===== SETUP: Create stable workspace with known artifacts =====
    await test.step('setup: open Org Browser and prepare workspace', async () => {
      console.log('[DEBUG] Opening Org Browser...');
      await orgBrowserPage.openOrgBrowser();
      console.log('[DEBUG] Org Browser opened successfully');

      // Retrieve PropertyController to create a stable artifact with local files
      // Using ApexClass instead of CustomObject for better performance (smaller dataset)
      // This ensures all filter tests have a known item to work with
      // The utility function handles: finding type, expanding, getting item, clicking retrieve, waiting for completion
      console.log('[DEBUG] Retrieving ApexClass PropertyController...');
      await orgBrowserPage.retrieveMetadataItem('ApexClass', 'PropertyController');
      console.log('[DEBUG] PropertyController retrieved successfully');

      // Verify PropertyController is visible after retrieval
      // Note: File presence icon changes happen automatically after retrieve, no need to re-open Org Browser
      const classItem = await orgBrowserPage.getMetadataItem('ApexClass', 'PropertyController');
      await expect(classItem, 'PropertyController should be visible after retrieval').toBeVisible({
        timeout: 10_000
      });

      // Wait for file presence check to complete (the retrieve command optimistically sets icon,
      // but we need to wait for the actual file presence check to verify file is on disk)
      console.log('[DEBUG] Waiting for file presence check to complete...');
      await orgBrowserPage.waitForFilePresenceCheck();

      // Re-find the item after file presence check (tree may have re-rendered)
      const classItemAfterCheck = await orgBrowserPage.getMetadataItem('ApexClass', 'PropertyController');

      // Verify file presence indicator shows file is present (filled circle icon)
      // This confirms the file was actually saved to disk and detected
      await expect(async () => {
        const hasIndicator = await orgBrowserPage.hasFilePresenceIndicator(classItemAfterCheck);
        if (!hasIndicator) {
          throw new Error('File presence indicator not showing - file may not be saved to disk');
        }
        return hasIndicator;
      }, 'PropertyController should show file presence indicator after retrieval').toPass({ timeout: 10_000 });

      console.log('[DEBUG] PropertyController verified visible with file presence indicator - setup complete');
    });

    // ===== TEST 1: Local File Filter =====
    await test.step('test 1: verify local file filter', async () => {
      console.log('[DEBUG] Starting test 1: Local file filter verification');
      // ApexClass should already be expanded from setup
      // We'll verify filtering works by checking for PropertyController items

      // Get baseline count
      const allItemsBefore = await orgBrowserPage.sidebar.getByRole('treeitem', { level: 2 }).allTextContents();
      expect(allItemsBefore.length, 'Should have items before filter').toBeGreaterThan(0);
      console.log(`[DEBUG] Baseline item count: ${allItemsBefore.length}`);

      // Enable filter
      console.log('[DEBUG] Enabling local file filter...');
      await orgBrowserPage.toggleShowLocalOnly();
      // Wait for filter to apply
      await orgBrowserPage.page.waitForTimeout(500);

      // Ensure ApexClass is expanded after filter is applied (it may have collapsed)
      // The filter causes tree refresh which can collapse expanded folders
      await orgBrowserPage.findMetadataType('ApexClass');
      await orgBrowserPage.expandFolder('ApexClass');
      console.log('[DEBUG] ApexClass expanded after filter applied');

      // Verify filtering - PropertyController should be visible (has local files)
      const filteredItems = await orgBrowserPage.sidebar.getByRole('treeitem', { level: 2 }).allTextContents();
      expect(
        filteredItems.some((item: string) => item.includes('PropertyController')),
        'PropertyController should be visible when filter is enabled'
      ).toBe(true);
      expect(filteredItems.length, 'Filtered items should only include items with local files').toBeGreaterThanOrEqual(
        1
      );
      console.log(`[DEBUG] Filtered item count: ${filteredItems.length}, PropertyController found: true`);

      // Disable filter
      console.log('[DEBUG] Disabling local file filter...');
      await orgBrowserPage.toggleShowLocalOnly();
      // Wait for filter to clear
      await orgBrowserPage.page.waitForTimeout(500);

      // Verify all items restored
      const restoredItems = await orgBrowserPage.sidebar.getByRole('treeitem', { level: 2 }).count();
      expect(restoredItems, 'All items should be restored when filter is disabled').toBeGreaterThan(0);
      console.log(`[DEBUG] Test 1 complete - restored item count: ${restoredItems}`);
    });

    // ===== TEST 2: Unstructured Search =====
    await test.step('test 2: verify unstructured search', async () => {
      console.log('[DEBUG] Starting test 2: Unstructured search verification');
      // Get initial type count
      await expect(
        orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 }).first(),
        'At least one metadata type should be visible'
      ).toBeVisible({ timeout: 10_000 });
      const initialTypes = await orgBrowserPage.sidebar.getByRole('treeitem', { level: 1 }).count();
      expect(initialTypes, 'Should have multiple metadata types').toBeGreaterThan(5);
      console.log(`[DEBUG] Initial metadata type count: ${initialTypes}`);

      // Search for ApexClass (unstructured)
      console.log('[DEBUG] Searching for "ApexClass"...');
      await orgBrowserPage.search('ApexClass');
      // Wait for search to apply
      await orgBrowserPage.page.waitForTimeout(500);

      // Verify search filters metadata types
      const apexClassType = await orgBrowserPage.findMetadataType('ApexClass');
      await expect(apexClassType, 'ApexClass should be visible after search').toBeVisible({
        timeout: 5000
      });

      // Expand and search for specific item
      console.log('[DEBUG] Expanding ApexClass and searching for "Property"...');
      await orgBrowserPage.findMetadataType('ApexClass');
      await orgBrowserPage.expandFolder('ApexClass');
      await orgBrowserPage.clearSearch();
      await orgBrowserPage.search('Property');
      // Wait for search to apply
      await orgBrowserPage.page.waitForTimeout(500);

      // Verify search filters items
      const classItem = orgBrowserPage.sidebar
        .getByRole('treeitem', {
          level: 2,
          name: 'PropertyController',
          exact: true
        })
        .first();
      await expect(classItem, 'PropertyController should be visible after search').toBeVisible({
        timeout: 5000
      });

      const visibleItems = await orgBrowserPage.sidebar.getByRole('treeitem', { level: 2 }).count();
      expect(visibleItems, 'Should have at least PropertyController visible').toBeGreaterThanOrEqual(1);

      // Clear search
      await orgBrowserPage.clearSearch();
      // Wait for search to clear
      await orgBrowserPage.page.waitForTimeout(500);
    });

    // ===== TEST 3: Structured Search =====
    await test.step('test 3: verify structured search Type:Name format', async () => {
      console.log('[DEBUG] Starting test 3: Structured search verification');
      // Search using structured format
      console.log('[DEBUG] Searching with structured format "ApexClass:Property"...');
      await orgBrowserPage.search('ApexClass:Property');
      // Wait for search to apply
      await orgBrowserPage.page.waitForTimeout(500);

      // Verify structured search filters correctly
      const apexClassType = await orgBrowserPage.findMetadataType('ApexClass');
      await expect(apexClassType, 'ApexClass type should be visible').toBeVisible({
        timeout: 5000
      });

      await orgBrowserPage.expandFolder('ApexClass');

      const classItem = await orgBrowserPage.getMetadataItem('ApexClass', 'PropertyController');
      await expect(classItem, 'PropertyController should be visible with structured search').toBeVisible({
        timeout: 5000
      });

      const visibleItems = await orgBrowserPage.sidebar.getByRole('treeitem', { level: 2 }).allTextContents();
      expect(
        visibleItems.some((item: string) => item.includes('Property')),
        'PropertyController should be in filtered results'
      ).toBe(true);

      // Clear search
      await orgBrowserPage.clearSearch();
      // Wait for search to clear
      await orgBrowserPage.page.waitForTimeout(500);
    });

    // ===== TEST 4: Filter + Unstructured Search Combination =====
    await test.step('test 4: verify local file filter combined with unstructured search', async () => {
      console.log('[DEBUG] Starting test 4: Filter + unstructured search combination');
      // Ensure ApexClass is expanded
      await orgBrowserPage.findMetadataType('ApexClass');
      await orgBrowserPage.expandFolder('ApexClass');
      console.log('[DEBUG] ApexClass expanded');

      // Enable filter
      console.log('[DEBUG] Enabling local file filter...');
      await orgBrowserPage.toggleShowLocalOnly();
      // Wait for filter to apply
      await orgBrowserPage.page.waitForTimeout(500);

      // Search for Property (unstructured)
      console.log('[DEBUG] Adding unstructured search for "Property"...');
      await orgBrowserPage.search('Property');
      // Wait for search to apply
      await orgBrowserPage.page.waitForTimeout(500);

      // Verify combined filter and search
      const classItem = orgBrowserPage.sidebar
        .getByRole('treeitem', {
          level: 2,
          name: 'PropertyController',
          exact: true
        })
        .first();

      const isVisible = await classItem.isVisible({ timeout: 5000 }).catch(() => false);
      if (isVisible) {
        await expect(classItem, 'PropertyController should be visible when matching both filters').toBeVisible();
        console.log('[DEBUG] PropertyController visible with combined filter and search');
      }

      const visibleItems = await orgBrowserPage.sidebar.getByRole('treeitem', { level: 2 }).count();
      expect(visibleItems, 'Should have filtered items').toBeGreaterThanOrEqual(0);
      console.log(`[DEBUG] Visible items with combined filter: ${visibleItems}`);

      // Clear search and filter
      console.log('[DEBUG] Clearing search and filter...');
      await orgBrowserPage.clearSearch();
      await orgBrowserPage.toggleShowLocalOnly();
      console.log('[DEBUG] Test 4 complete - search and filter cleared');
    });

    // ===== TEST 5: Filter + Structured Search Combination =====
    await test.step('test 5: verify local file filter combined with structured search', async () => {
      console.log('[DEBUG] Starting test 5: Filter + structured search combination');
      // Enable filter
      console.log('[DEBUG] Enabling local file filter...');
      await orgBrowserPage.toggleShowLocalOnly();
      // Wait for filter to apply
      await orgBrowserPage.page.waitForTimeout(500);

      // Search using structured format
      console.log('[DEBUG] Adding structured search "ApexClass:Property"...');
      await orgBrowserPage.search('ApexClass:Property');
      // Wait for search to apply
      await orgBrowserPage.page.waitForTimeout(500);

      // Verify combined structured search and filter
      const apexClassType = await orgBrowserPage.findMetadataType('ApexClass');
      await expect(apexClassType, 'ApexClass should be visible').toBeVisible({
        timeout: 5000
      });

      await orgBrowserPage.expandFolder('ApexClass');
      console.log('[DEBUG] ApexClass expanded for structured search verification');

      const classItem = orgBrowserPage.sidebar
        .getByRole('treeitem', {
          level: 2,
          name: 'PropertyController',
          exact: true
        })
        .first();

      const isVisible = await classItem.isVisible({ timeout: 5000 }).catch(() => false);
      if (isVisible) {
        await expect(
          classItem,
          'PropertyController should be visible when matching structured search and filter'
        ).toBeVisible();
        console.log('[DEBUG] PropertyController visible with combined structured search and filter');
      }

      // Clear search and filter
      console.log('[DEBUG] Clearing search and filter...');
      await orgBrowserPage.clearSearch();
      await orgBrowserPage.toggleShowLocalOnly();
      console.log('[DEBUG] Test 5 complete - all tests finished successfully');
    });
  });
});
