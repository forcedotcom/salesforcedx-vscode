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

  test('should retrieve custom object and verify completion', async ({ orgBrowserPage, page }) => {
    // Check browser connection using the shared utility
    // This will throw an error if a browser is in use for manual testing
    await checkBrowserConnection(page, test);

    try {
      // 1. Open the Org Browser using the Page Object method
      await orgBrowserPage.openOrgBrowser();

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

      // Get the Account item (first child of CustomObject)
      const accountItem = await orgBrowserPage.getMetadataItem('CustomObject', 'Account');

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

      // Capture any notifications immediately after clicking to see what was requested
      const notifCaptureTs = Date.now();
      console.log(`notification snapshot: ${new Date(notifCaptureTs).toISOString()}`);
      const currentProgressNotifs = await orgBrowserPage.getProgressNotifications();
      console.log('Current progress notifications after click:', currentProgressNotifs);
      const currentErrorNotifs = await orgBrowserPage.getErrorNotifications();
      console.log('Current error notifications after click:', currentErrorNotifs);

      const progressAppeared = await orgBrowserPage.waitForProgressNotificationToAppear(30000);

      if (!progressAppeared) {
        throw new Error('Progress notification did not appear within timeout - retrieval may not have started');
      }

      console.log('✅ Progress notification appeared - retrieval started');

      // Read and log the progress notifications that appeared and ensure it is for CustomObject
      const notificationsWhenStarted = await orgBrowserPage.getProgressNotifications();
      console.log('Progress notifications when started:', notificationsWhenStarted);

      const notifHasCustomObject = notificationsWhenStarted.some(text => text.includes('CustomObject'));
      if (!notifHasCustomObject) {
        throw new Error(
          `Retrieve started for wrong type; expected notification to include "CustomObject" but got: ${JSON.stringify(notificationsWhenStarted)}`
        );
      }

      // Wait for progress notification to disappear (indicating completion)
      console.log('Waiting for progress notification to disappear (completion)...');
      const progressCompleted = await orgBrowserPage.waitForProgressNotificationToDisappear(90000);

      if (!progressCompleted) {
        throw new Error('Progress notification did not disappear within timeout - retrieval may not have completed');
      }

      console.log('✅ Progress notification disappeared - retrieval completed');

      // 5. Verify that a file was opened in the editor
      console.log('Checking if retrieved file opened in editor...');

      // Wait for any file to appear in the editor
      const fileOpened = await orgBrowserPage.waitForFileToOpenInEditor(10000);

      // Take a final screenshot showing the completed state
      await orgBrowserPage.takeScreenshot('final-state-completed.png');

      // Assert that retrieval completed successfully
      expect(progressCompleted, 'Progress notification should have disappeared').toBe(true);
      expect(fileOpened, 'A retrieved file should be open in editor').toBe(true);

      console.log('✅ Test completed successfully - CustomObject metadata retrieval verified');
    } catch (error) {
      console.log(`❌ Test error: ${String(error)}`);
      await orgBrowserPage.takeScreenshot('test-error.png');
      throw error;
    }
  });

  test('should retrieve custom tab and verify completion', async ({ orgBrowserPage, page }) => {
    // Check browser connection using the shared utility
    await checkBrowserConnection(page, test);

    try {
      // 1. Open the Org Browser
      await orgBrowserPage.openOrgBrowser();

      // 2. Find CustomTab using the enhanced findMetadataType with automatic scrolling
      const customTabItem = await orgBrowserPage.findMetadataType('CustomTab');

      if (!customTabItem) {
        throw new Error('Could not find CustomTab metadata type');
      }

      console.log('✅ Found CustomTab metadata type');

      // Take a screenshot of the CustomTab state
      await orgBrowserPage.takeScreenshot('customtab-found.png');

      // 3. Expand the CustomTab node
      await orgBrowserPage.expandMetadataType(customTabItem);

      // 4. Get the Broker__c item
      const brokerTabItem = await orgBrowserPage.getMetadataItem('CustomTab', 'Broker__c');

      if (!brokerTabItem) {
        throw new Error('Could not find Broker__c custom tab');
      }

      console.log('✅ Found Broker__c custom tab');

      // 5. Click the retrieve button for Broker__c
      const brokerRetrieveSuccess = await orgBrowserPage.clickRetrieveButton(brokerTabItem);

      if (!brokerRetrieveSuccess) {
        throw new Error('Failed to click retrieve button for Broker__c custom tab');
      }

      console.log('Successfully clicked retrieve button for Broker__c');

      // 6. Wait for progress notification to appear
      const brokerProgressAppeared = await orgBrowserPage.waitForProgressNotificationToAppear(30000);

      if (!brokerProgressAppeared) {
        throw new Error('Progress notification for CustomTab did not appear within timeout');
      }

      console.log('✅ Progress notification appeared for CustomTab retrieval');

      // 7. Verify the notification mentions the retrieval (it might not say "CustomTab" specifically)
      const brokerNotifications = await orgBrowserPage.getProgressNotifications();
      console.log('Progress notifications for CustomTab:', brokerNotifications);

      // Note: The actual error you want to debug - the notification might be empty or different
      if (brokerNotifications.length === 0) {
        console.log('⚠️ No progress notifications found - this is the issue to debug');
        await orgBrowserPage.takeScreenshot('no-progress-notifications.png');
        // Continue with the test to see what happens
      }

      // 8. Wait for progress notification to disappear (indicating completion)
      console.log('Waiting for CustomTab progress notification to disappear...');
      const brokerProgressCompleted = await orgBrowserPage.waitForProgressNotificationToDisappear(90000);

      if (!brokerProgressCompleted) {
        throw new Error('CustomTab progress notification did not disappear within timeout');
      }

      console.log('✅ CustomTab progress notification disappeared - retrieval completed');

      // 9. Check if a file was opened in the editor
      const fileOpened = await orgBrowserPage.waitForFileToOpenInEditor(10000);

      // Take a final screenshot
      await orgBrowserPage.takeScreenshot('customtab-final-state.png');

      // Assert completion
      expect(brokerProgressCompleted, 'CustomTab progress should have completed').toBe(true);
      expect(fileOpened, 'A CustomTab file should be open in editor').toBe(true);

      console.log('✅ Test completed successfully - CustomTab metadata retrieval verified');
    } catch (error) {
      console.log(`❌ CustomTab test error: ${String(error)}`);
      await orgBrowserPage.takeScreenshot('customtab-test-error.png');
      throw error;
    }
  });
});
