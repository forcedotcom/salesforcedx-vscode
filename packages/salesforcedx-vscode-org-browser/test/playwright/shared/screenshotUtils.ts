/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This is Node.js test infrastructure, not extension code
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Page } from '@playwright/test';

/**
 * Ensures the test-results directory exists and saves a screenshot there
 * @param page Playwright page object
 * @param fileName Name of the screenshot file
 * @param fullPage Whether to take a full page screenshot
 * @returns Path to the saved screenshot
 */
export const saveScreenshot = async (page: Page, fileName: string, fullPage = false): Promise<string> => {
  try {
    // Ensure test-results directory exists
    const testResultsDir = path.join(process.cwd(), 'test-results');
    fs.mkdirSync(testResultsDir, { recursive: true });

    // Create the full path
    const filePath = path.join(testResultsDir, fileName);

    // Take the screenshot
    await page.screenshot({ path: `./${filePath}`, fullPage });

    return filePath;
  } catch (error) {
    console.error(`Failed to save screenshot: ${String(error)}`);
    return '';
  }
};
