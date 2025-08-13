/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { test, expect } from './fixtures/cdpFixture';
import { checkBrowserConnection } from './shared/browserConnectionUtils';

/**
 * Test suite for Salesforce Org Browser web extension - Foldered Report functionality
 * Tests run against VS Code web served by vscode-test-web
 *
 * Using fixtures for CDP connection and Org Browser page
 */
test.describe('Org Browser Web Extension - Foldered Report', () => {
  test('should retrieve foldered report and verify completion', async ({ orgBrowserPage, page }) => {
    // Check browser connection using the shared utility
    await checkBrowserConnection(page, test);

    try {
      // 1. Open the Org Browser
      await orgBrowserPage.openOrgBrowser();

      // 2. Find Report metadata type using the enhanced findMetadataType with automatic scrolling
      const reportItem = await orgBrowserPage.findMetadataType('Report');

      // Take a screenshot of the Report state
      await orgBrowserPage.takeScreenshot('report-found.png');

      // 3. Expand the Report node to show folders
      await orgBrowserPage.expandFolder(reportItem);

      const folderName = 'unfiled$public';
      // 4. Find the unfiled$Public folder (level 2)
      const unfiledFolderItem = await orgBrowserPage.getMetadataItem('Report', folderName, 2);

      // 5. Expand the folder to show reports inside
      await orgBrowserPage.expandFolder(unfiledFolderItem);

      // 6. Get a specific report within the folder
      const reportComponentItem = await orgBrowserPage.getMetadataItem(
        'Report',
        `${folderName}/flow_orchestration_log`,
        3
      );

      // 7. Click the retrieve button for the specific report
      const reportRetrieveSuccess = await orgBrowserPage.clickRetrieveButton(reportComponentItem);

      if (!reportRetrieveSuccess) {
        throw new Error('Failed to click retrieve button for foldered report');
      }

      console.log('Successfully clicked retrieve button for foldered report');

      // 8. Wait for progress notification to appear
      const reportProgressAppeared = await orgBrowserPage.waitForProgressNotificationToAppear(30000);

      if (!reportProgressAppeared) {
        throw new Error('Progress notification for foldered Report did not appear within timeout');
      }

      console.log('✅ Progress notification appeared for foldered Report retrieval');

      // 9. Verify the notification mentions the retrieval
      const reportNotifications = await orgBrowserPage.getProgressNotifications();
      console.log('Progress notifications for foldered Report:', reportNotifications);

      // Note: Debug any notification issues
      if (reportNotifications.length === 0) {
        console.log('⚠️ No progress notifications found - this is the issue to debug');
        await orgBrowserPage.takeScreenshot('no-progress-notifications-foldered.png');
        // Continue with the test to see what happens
      }

      // 10. Wait for progress notification to disappear (indicating completion)
      console.log('Waiting for foldered Report progress notification to disappear...');
      const reportProgressCompleted = await orgBrowserPage.waitForProgressNotificationToDisappear(90000);

      if (!reportProgressCompleted) {
        throw new Error('Foldered Report progress notification did not disappear within timeout');
      }

      console.log('✅ Foldered Report progress notification disappeared - retrieval completed');

      // 11. Check if a file was opened in the editor
      const fileOpened = await orgBrowserPage.waitForFileToOpenInEditor(10000);

      // Take a final screenshot
      await orgBrowserPage.takeScreenshot('foldered-report-final-state.png');

      // Assert completion
      expect(reportProgressCompleted, 'Foldered Report progress should have completed').toBe(true);
      expect(fileOpened, 'A foldered Report file should be open in editor').toBe(true);

      console.log('✅ Test completed successfully - foldered Report metadata retrieval verified');
    } catch (error) {
      console.log(`❌ Foldered Report test error: ${String(error)}`);
      await orgBrowserPage.takeScreenshot('foldered-report-test-error.png');
      throw error;
    }
  });
});
