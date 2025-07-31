/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { test, expect } from './fixtures/cdpFixture';

const typesOfInterest = ['Object', 'Field', 'Apex', 'Class', 'Component'];

/**
 * Test suite for Salesforce Org Browser web extension
 * Tests run against VS Code web served by vscode-test-web
 *
 * Using fixtures for CDP connection and Org Browser page
 */
test.describe('Org Browser Web Extension', () => {
  test('should verify org browser metadata types and tree functionality', async ({
    orgBrowserPage,
    cdpConnection,
    testConfig
  }) => {
    // Open the Org Browser
    await orgBrowserPage.open();

    // Take a screenshot to help with debugging
    await orgBrowserPage.page.screenshot({ path: 'test-results/full-page-screenshot.png', fullPage: true });
    console.log('✅ Screenshot saved to test-results/full-page-screenshot.png');

    // Find CustomObject using enhanced findMetadataType (which now waits internally)
    console.log('🔍 Looking for CustomObject metadata type...');
    const customObjectItem = await orgBrowserPage.findMetadataType('CustomObject');

    // If findMetadataType fails, log the error but don't try fallback
    if (!customObjectItem) {
      console.log('Failed to find CustomObject using findMetadataType');
    }

    // Check if we found CustomObject
    if (customObjectItem) {
      console.log('✅ Successfully found CustomObject metadata type');

      // Try to expand the metadata type
      await orgBrowserPage.expandMetadataType(customObjectItem);

      // Take a screenshot after expansion
      await orgBrowserPage.takeScreenshot('after-expansion.png');
    } else {
      console.log('❌ CustomObject not found - test will fail');

      // If we need a fallback for any metadata type:
      for (const type of typesOfInterest) {
        const fallbackItem = await orgBrowserPage.findMetadataType(type);
        if (fallbackItem) {
          console.log(`Found fallback metadata type: ${type}`);
          break;
        }
      }
    }

    // Assert that we found CustomObject
    expect(customObjectItem).not.toBeNull();

    // Wait for any async operations to complete
    console.log('⏳ Waiting for tree data loading and potential errors...');
    await orgBrowserPage.page.waitForTimeout(500);

    // Check for VS Code notification errors
    const errorTexts = await orgBrowserPage.getErrorNotifications();
    if (errorTexts.length > 0) {
      errorTexts.forEach((errorText, i) => {
        console.log(`  Error ${i + 1}: ${errorText}`);
      });
    }

    // Check for removeAllListeners errors
    const hasRemoveAllListenersErrors = cdpConnection.capture.removeAllListenersErrors.length > 0;

    if (hasRemoveAllListenersErrors) {
      console.log('❌ Found removeAllListeners errors - this indicates a polyfill issue:');
      cdpConnection.capture.removeAllListenersErrors.forEach(error => console.log(`  - ${error}`));
    } else {
      console.log('✅ No removeAllListeners errors found - polyfill working correctly');
    }

    // Get the count of tree items for reporting
    const treeItemCount = await orgBrowserPage.page.locator('.monaco-list-row').count();

    // Log test results
    console.log('\n📊 Test Results:');
    console.log('  - VS Code loaded: YES');
    console.log('  - Org Browser clicked: YES');
    console.log(`  - Tree items found: ${treeItemCount > 0 ? 'YES' : 'NO'} (${treeItemCount} items)`);
    console.log(`  - CustomObject found: ${customObjectItem ? '✅ YES' : '❌ NO - REQUIRED'}`);
    console.log(`  - Tree item interaction attempted: ${customObjectItem ? 'YES' : 'NO'}`);
    console.log(
      `  - removeAllListeners errors: ${hasRemoveAllListenersErrors ? '❌ YES - ISSUE FOUND' : '✅ NONE - GOOD'}`
    );

    // Test assertions
    expect(hasRemoveAllListenersErrors).toBe(false);

    if (testConfig.requireCustomObject) {
      // Strict check for CustomObject
      expect(customObjectItem).not.toBeNull();
    } else {
      // More lenient check - any metadata type is acceptable
      expect(customObjectItem ?? null).not.toBeNull();
    }
  });

  test('should retrieve metadata and check for project error', async ({ orgBrowserPage, page }) => {
    // Increase test timeout to 90 seconds
    test.setTimeout(90000);

    // Verify the page is still connected before proceeding
    try {
      await page.evaluate(() => document.title);
    } catch (error) {
      console.log('Browser connection issue detected:', String(error));
      test.skip();
      console.log('Browser connection lost - skipping test');
      return;
    }
    try {
      // Check if we're connected to an existing browser that might be in use
      const isExistingBrowser = await page
        .evaluate(
          // @ts-ignore
          () => window.__playwright_existing_browser === true
        )
        .catch(() => false);

      if (isExistingBrowser) {
        console.log('⚠️ Test is running in an existing browser session that might be in use for manual testing.');
        console.log('⚠️ Please close any browser instances on port 3000 before running this test.');
        test.skip();
        return;
      }

      // 1. Open the Org Browser using the Page Object method
      await orgBrowserPage.open();
      console.log('✅ Org Browser opened');

      // Find CustomObject using enhanced findMetadataType (which now waits internally)
      console.log('Searching for CustomObject...');
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

      // Find Account object using the enhanced findMetadataType method
      console.log('Looking for Account object...');

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

      // Look specifically for the "Not a Salesforce project" error
      const projectError = errorTexts.some(
        text =>
          text.includes('Not a Salesforce project') ||
          text.includes('InvalidProjectWorkspaceError') ||
          text.includes('memfs:/MyProject')
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
