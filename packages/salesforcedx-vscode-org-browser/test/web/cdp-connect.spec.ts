/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { test } from '@playwright/test';
import { connectToCDPBrowser, reportConsoleCapture } from './shared/cdp-utils';

test.describe('Org Browser Web Extension - CDP Connection', () => {
  test('should connect to existing browser and capture console errors', async () => {
    try {
      // Connect to the existing Chrome instance launched by vscode-test-web
      const { page, capture } = await connectToCDPBrowser(9222);

      // Navigate to the Org Browser
      try {
        console.log('Looking for Org Browser in activity bar...');
        await page.waitForSelector('.activitybar a[aria-label*="Org Browser"]', { timeout: 10000 });

        const orgBrowserAction = page.locator('.activitybar a[aria-label*="Org Browser"]');
        await orgBrowserAction.click();
        console.log('✅ Successfully clicked Org Browser activity bar item');

        // Wait for potential errors to surface
        await page.waitForTimeout(5000);

        // Look for tree items
        console.log('Looking for tree items to expand...');
        const treeItems = await page.locator('[role="treeitem"]').all();
        console.log(`Found ${treeItems.length} tree items`);

        if (treeItems.length > 0) {
          try {
            console.log('Attempting to click first tree item...');
            await treeItems[0].click({ timeout: 10000 });
            console.log('Clicked first tree item');
          } catch (clickError) {
            console.log(
              'Could not click tree item:',
              clickError instanceof Error ? clickError.message : String(clickError)
            );
          }
        }

        // Wait a bit more for any additional errors
        await page.waitForTimeout(5000);

        // Report results
        reportConsoleCapture(capture);

        if (capture.removeAllListenersErrors.length > 0) {
          throw new Error(
            `Found ${capture.removeAllListenersErrors.length} removeAllListeners errors. This suggests EventEmitter polyfill issues.`
          );
        }

        if (capture.fiberFailureErrors.length > 0) {
          throw new Error(
            `Found ${capture.fiberFailureErrors.length} FiberFailure errors. This suggests Effect-TS runtime issues.`
          );
        }

        // Allow some console errors as they might be expected during development
        if (capture.consoleErrors.length > 5) {
          console.warn(`Warning: Found ${capture.consoleErrors.length} console errors. Review logs above.`);
        }
      } catch (error) {
        console.error('Test error:', error);
        reportConsoleCapture(capture);
        throw error;
      }
    } catch (error) {
      console.error('CDP connection failed:', error);
      throw error;
    }
  });
});
