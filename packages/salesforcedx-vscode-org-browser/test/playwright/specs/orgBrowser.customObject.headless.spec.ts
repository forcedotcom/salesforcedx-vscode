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

test.describe('Org Browser - CustomObject retrieval', () => {
  test.setTimeout(2 * 60 * 1000);

  test.beforeEach(async ({ page }) => {
    const createResult = await create();
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
  });

  test('customobject headless: retrieve Broker__c', async ({ page }) => {
    const orgBrowserPage = new OrgBrowserPage(page);

    await test.step('open Org Browser', async () => {
      await orgBrowserPage.openOrgBrowser();
    });

    await test.step('find CustomObject type', async () => {
      const locator = await orgBrowserPage.findMetadataType('CustomObject');
      await locator.hover();
      await expect(locator).toMatchAriaSnapshot({ name: 'customobject-found' });
    });

    await test.step('expand CustomObject and locate Broker__c', async () => {
      await orgBrowserPage.expandFolder('CustomObject');
      const item = await orgBrowserPage.getMetadataItem('CustomObject', 'Broker__c');
      await item.hover();
      await expect(item).toMatchAriaSnapshot({ name: 'customobject-broker__c' });
    });

    await test.step('verify file presence decorator shows file not present before retrieval', async () => {
      // Wait for file presence check to complete (workspace is empty initially)
      await orgBrowserPage.waitForFilePresenceCheck();

      // Re-find the item after file presence check (tree may have re-rendered)
      const brokerItemBeforeRetrieval = await orgBrowserPage.getMetadataItem('CustomObject', 'Broker__c');

      // Verify icon shows file not present (circle-large-outline)
      const filePresenceIcon = brokerItemBeforeRetrieval.locator('.codicon-circle-large-outline, .codicon-pass-filled').first();
      await expect(filePresenceIcon, 'File presence icon should be visible before retrieval').toBeVisible({ timeout: 5000 });

      // Verify it's the "not present" icon (circle-large-outline)
      const iconClass = await filePresenceIcon.getAttribute('class');
      expect(iconClass, 'Icon should show file not present (circle-large-outline)').toContain('circle-large-outline');
    });

    await test.step('trigger retrieval', async () => {
      // Re-find the item before clicking retrieve (locator may be stale after file presence check)
      const brokerItemForRetrieval = await orgBrowserPage.getMetadataItem('CustomObject', 'Broker__c');
      const clicked = await orgBrowserPage.clickRetrieveButton(brokerItemForRetrieval);
      expect(clicked).toBe(true);

      // Wait for retrieval progress notification
      await waitForRetrieveProgressNotificationToAppear(page, 60_000);

      // Wait for file to open in editor (completion signal)
      await orgBrowserPage.waitForFileToOpenInEditor(120_000);

      // Wait for file presence check
      await orgBrowserPage.waitForFilePresenceCheck();
    });

    await test.step('verify file presence decorator shows file present after retrieval', async () => {
      // After retrieval, fireChangeEvent should automatically update the tree
      // Clear any focus/hover state by clicking on the sidebar background
      const sidebar = orgBrowserPage.sidebar;
      try {
        await sidebar.click({ position: { x: 10, y: 10 }, timeout: 2000 });
      } catch {
        // If clicking sidebar fails, try pressing Escape to clear focus
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(500); // Wait for UI to settle and focus to clear

      // Wait for icon to update - use same selector pattern as "before retrieval" check
      await expect(async () => {
        // Re-find the item each attempt to get a fresh locator
        const brokerItemAfterRetrieval = await orgBrowserPage.getMetadataItem('CustomObject', 'Broker__c');

        // Use the same selector pattern as the "before retrieval" check
        const filePresenceIcon = brokerItemAfterRetrieval.locator('.codicon-circle-large-outline, .codicon-pass-filled').first();
        const isVisible = await filePresenceIcon.isVisible({ timeout: 500 }).catch(() => false);
        if (!isVisible) {
          // Check all icons in the item to see what's there
          const allIcons = brokerItemAfterRetrieval.locator('.codicon');
          const iconCount = await allIcons.count();
          const iconClasses: string[] = [];
          for (let i = 0; i < iconCount; i++) {
            const icon = allIcons.nth(i);
            const iconClass = await icon.getAttribute('class').catch(() => '');
            if (iconClass) iconClasses.push(iconClass);
          }
          throw new Error(`File presence icon not visible yet. Found ${iconCount} icons with classes: ${iconClasses.join(', ')}`);
        }

        const iconClass = await filePresenceIcon.getAttribute('class');
        if (!iconClass?.includes('pass-filled')) {
          throw new Error(`Icon class is "${iconClass}", expected to contain "pass-filled"`);
        }

        return iconClass;
      }, 'File presence icon should show pass-filled after retrieval').toPass({ timeout: 10_000, intervals: [100, 200, 500] });
    });

    await test.step('override confirmation for Broker__c', async () => {
      // Use utility function to handle override confirmation flow
      await orgBrowserPage.retrieveMetadataItemWithOverride('CustomObject', 'Broker__c');
    });
  });
});
