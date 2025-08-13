/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { test, expect } from './fixtures/cdpFixture';
import { checkBrowserConnection } from './shared/browserConnectionUtils';

/**
 * Test suite for Salesforce Org Browser web extension - CustomTab functionality
 * Tests run against VS Code web served by vscode-test-web
 *
 * Using fixtures for CDP connection and Org Browser page
 */
test.describe('Org Browser Web Extension - CustomTab', () => {
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

      // Take a screenshot of the CustomTab state
      await orgBrowserPage.takeScreenshot('customtab-found.png');

      // 3. Expand the CustomTab node
      await orgBrowserPage.expandFolder(customTabItem);

      // 4. Get the Broker__c item
      const brokerTabItem = await orgBrowserPage.getMetadataItem('CustomTab', 'Broker__c');

      if (!brokerTabItem) {
        throw new Error('Could not find Broker__c custom tab');
      }

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
