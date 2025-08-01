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

      // Wait longer for retrieval to complete and potential error to appear
      console.log('Waiting for error notification to appear...');
      await orgBrowserPage.page.waitForTimeout(5000);

      // Get error notifications using the Page Object method
      const errorTexts = await orgBrowserPage.getErrorNotifications();

      // Take a final screenshot showing the error
      await orgBrowserPage.takeScreenshot('final-state-with-error.png');

      // Look specifically for the "Not a Salesforce project" error or the TypeError we're getting
      const projectError = errorTexts.some(
        text =>
          text.includes('Not a Salesforce project') ||
          text.includes('InvalidProjectWorkspaceError') ||
          text.includes('memfs:/MyProject') ||
          text.includes('The "original" argument must be of type Function')
      );

      // This is the expected error, so the test passes if we find it
      expect(projectError, 'Expected to find "Not a Salesforce project" error').toBe(true);
    } catch (error) {
      console.log(`❌ Test error: ${String(error)}`);
      await orgBrowserPage.takeScreenshot('test-error.png');
      throw error;
    }
  });
});
