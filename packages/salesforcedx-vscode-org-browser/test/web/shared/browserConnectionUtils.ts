/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Page } from '@playwright/test';

/**
 * Checks if the browser connection is valid and if the test should be skipped
 * Handles both disconnected browsers and browsers that might be in use for manual testing
 *
 * @param page The Playwright page object
 * @param test The Playwright test object with skip method
 * @returns True if the test should continue, false if it should be skipped
 */
export const checkBrowserConnection = async (
  page: Page,
  test: { skip: (message?: string) => void }
): Promise<boolean> => {
  try {
    // First check if the browser is still connected
    await page.evaluate(() => document.title);

    // Then check if we're connected to an existing browser that might be in use
    const isExistingBrowser = await page
      .evaluate(
        // @ts-ignore - __playwright_existing_browser is injected by our CDP fixture
        () => window.__playwright_existing_browser === true
      )
      .catch(() => false);

    if (isExistingBrowser) {
      console.log('⚠️ Test is running in an existing browser session that might be in use for manual testing.');
      console.log('⚠️ Please close any browser instances on port 3000 before running this test.');
      throw new Error('Browser in use for manual testing - test failed');
    }

    return true;
  } catch (error) {
    console.log('Browser connection issue detected:', String(error));
    test.skip('Browser connection lost');
    return false;
  }
};
