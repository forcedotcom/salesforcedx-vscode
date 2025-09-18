/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { test, expect } from './fixtures/cdpFixture';
import { checkBrowserConnection } from './shared/browserConnectionUtils';

/**
 * Test suite for Salesforce Org Browser web extension - CustomObject functionality
 * Tests run against VS Code web served by vscode-test-web
 *
 * Using fixtures for CDP connection and Org Browser page
 */
test.describe('Org Browser Web Extension - CustomObject', () => {
  test('should retrieve custom object and verify completion', async ({ orgBrowserPage, page }) => {
    // Check browser connection using the shared utility
    // This will throw an error if a browser is in use for manual testing
    await checkBrowserConnection(page, test);

    try {
      // 1. Open the Org Browser using the Page Object method
      await orgBrowserPage.openOrgBrowser();

      const customObjectItem = await orgBrowserPage.findMetadataType('CustomObject');

      // Take a screenshot of the initial tree state
      await orgBrowserPage.takeScreenshot('initial-tree-state.png');

      // Assert that we found CustomObject
      expect(customObjectItem).not.toBeNull();

      if (!customObjectItem) {
        throw new Error('CustomObject node not found');
      }

      // 2. Expand the CustomObject node
      await customObjectItem.click();

      // Get the Account item (first child of CustomObject)
      const accountItem = await orgBrowserPage.getMetadataItem('CustomObject', 'Account');

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

      await orgBrowserPage.waitForRetrieveProgressNotificationToAppear(30000);

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
});
