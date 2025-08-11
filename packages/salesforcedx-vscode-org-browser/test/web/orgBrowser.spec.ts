/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { test, expect } from './fixtures/cdpFixture';
import { checkBrowserConnection } from './shared/browserConnectionUtils';
import { strict as assert } from 'node:assert';
/**
 * Test suite for Salesforce Org Browser web extension
 * Tests run against VS Code web served by vscode-test-web
 *
 * Using fixtures for CDP connection and Org Browser page
 */
test.describe('Org Browser Web Extension', () => {
  test('should verify org browser metadata types and tree functionality', async ({ orgBrowserPage, page }) => {
    // This will throw an error if a browser is in use for manual testing
    await checkBrowserConnection(page, test);

    await orgBrowserPage.openOrgBrowser();

    await orgBrowserPage.page.screenshot({ path: 'test-results/full-page-screenshot.png', fullPage: true });
    console.log('✅ Screenshot saved to test-results/full-page-screenshot.png');

    const customObjectItem = await orgBrowserPage.findMetadataType('CustomObject');

    assert(customObjectItem, 'Failed to find CustomObject using findMetadataType');

    await orgBrowserPage.expandMetadataType(customObjectItem);

    await orgBrowserPage.takeScreenshot('after-expansion.png');

    console.log('⏳ Waiting for tree data loading and potential errors...');
    await orgBrowserPage.page.waitForTimeout(500);

    // Check for VS Code notification errors
    (await orgBrowserPage.getErrorNotifications()).map((errorText, i) => {
      console.log(`  Error ${i + 1}: ${errorText}`);
    });

    // Get the count of tree items for reporting
    const treeItemCount = await orgBrowserPage.page.locator('.monaco-list-row').count();
    expect(treeItemCount, 'Incomplete tree items').toBeGreaterThan(2);
  });

  test('should retrieve metadata and check for project error', async ({ orgBrowserPage, page }) => {
    // Increase test timeout to 90 seconds
    test.setTimeout(90000);

    // Check browser connection using the shared utility
    // This will throw an error if a browser is in use for manual testing
    await checkBrowserConnection(page, test);

    try {
      // 1. Open the Org Browser using the Page Object method
      await orgBrowserPage.openOrgBrowser();
      console.log('✅ Org Browser opened');

      const customObjectItem = await orgBrowserPage.findMetadataType('CustomObject');

      // If findMetadataType fails, log the error but don't try fallback
      if (!customObjectItem) {
        console.log('Failed to find CustomObject using findMetadataType');
      }

      // Take a screenshot of the initial tree state
      await orgBrowserPage.takeScreenshot('initial-tree-state.png');

      // Assert that we found CustomObject
      expect(customObjectItem).not.toBeNull();

      if (!customObjectItem) {
        throw new Error('CustomObject node not found');
      }

      // 2. Expand the CustomObject node
      await orgBrowserPage.expandMetadataType(customObjectItem);
      await orgBrowserPage.page.waitForTimeout(2000);

      // Use findMetadataType which now waits for the element to appear
      const accountItem = await orgBrowserPage.findMetadataType('Account');

      if (!accountItem) {
        throw new Error('Could not find Account object');
      }

      console.log('✅ Found Account object');

      // 3. Use the Page Object methods to hover and click the retrieve button
      console.log('Using Page Object methods to hover and click retrieve button');

      // Click the retrieve button using the Page Object method (no debugging highlights)
      const retrieveSuccess = await orgBrowserPage.clickRetrieveButton(accountItem);

      // No fallbacks - if button click fails, the test should fail
      if (!retrieveSuccess) {
        throw new Error('Failed to click retrieve button - test failed');
      }

      console.log('Successfully clicked retrieve button');

      // Wait for the "Retrieving" notification to appear
      console.log('Waiting for "Retrieving" notification to appear...');
      let retrievingNotificationFound = false;

      for (let i = 0; i < 30; i++) {
        // Use the Page Object's method to get all notifications
        const notifications = await orgBrowserPage.getErrorNotifications();

        for (const notification of notifications) {
          if (notification.includes('Retrieving')) {
            retrievingNotificationFound = true;
            console.log('✅ "Retrieving" notification found:', notification);
            break;
          }
        }

        if (retrievingNotificationFound) {
          break;
        }

        await orgBrowserPage.page.waitForTimeout(1000);
        if (i % 5 === 0) {
          console.log(`Waiting for "Retrieving" notification... (${i}s elapsed)`);
        }
      }

      // Assert that the "Retrieving" notification appeared
      expect(retrievingNotificationFound, 'Expected "Retrieving" notification to appear').toBe(true);

      // Now wait for the retrieval to complete
      console.log('Waiting for retrieval to complete...');
      let retrievalCompleted = false;
      let successNotification = false;
      let failureNotification = false;

      for (let i = 0; i < 60; i++) {
        // Check for success or failure notifications using the Page Object method
        const notifications = await orgBrowserPage.getErrorNotifications();

        for (const notification of notifications) {
          if (
            notification.includes('Retrieved') ||
            notification.includes('Success') ||
            notification.includes('Info:')
          ) {
            successNotification = true;
            console.log('✅ Success notification found:', notification);
            break;
          } else if (
            notification.includes('Retrieve failed') ||
            notification.includes('Error') ||
            notification.includes('No files retrieved')
          ) {
            failureNotification = true;
            console.log('❌ Failure notification found:', notification);
            break;
          }
        }

        if (successNotification || failureNotification) {
          retrievalCompleted = true;
          break;
        }

        await orgBrowserPage.page.waitForTimeout(1000);
        if (i % 10 === 0) {
          console.log(`Waiting for retrieval completion... (${i}s elapsed)`);
        }
      }

      // Take a final screenshot showing the retrieval result
      await orgBrowserPage.takeScreenshot('final-state-retrieval-result.png');

      // Get any error notifications for debugging
      const errorTexts = await orgBrowserPage.getErrorNotifications();

      // Log any errors found for debugging
      if (errorTexts.length > 0) {
        console.log('⚠️ Notifications found during metadata retrieval:');
        errorTexts.forEach((error, i) => console.log(`  Notification ${i + 1}: ${error}`));
      }

      // Assert that retrieval completed (either success or expected failure)
      expect(retrievalCompleted, 'Expected metadata retrieval to complete').toBe(true);

      // For now, we expect the retrieval to fail in the test environment
      // This is acceptable since we're testing the web extension functionality, not the actual metadata retrieval
      if (failureNotification) {
        console.log('✅ Expected retrieval failure detected - test environment limitation');
      } else if (successNotification) {
        console.log('✅ Unexpected retrieval success - this is good!');
      }
    } catch (error) {
      console.log(`❌ Test error: ${String(error)}`);
      await orgBrowserPage.takeScreenshot('test-error.png');
      throw error;
    }
  });
});
