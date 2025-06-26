/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { log } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/core/miscellaneous';
import { TestSetup } from '@salesforce/salesforcedx-vscode-test-tools/lib/src/testSetup';

/**
 * Helper method to format test log messages with line break and "Running test: " prefix
 * @param testSetup The test setup instance containing the test suite suffix name
 * @param testDescription The description of the test being run
 */
export const logTestStart = (testSetup: TestSetup, testDescription: string): void => {
  log(`\nRunning test: ${testSetup.testSuiteSuffixName} - ${testDescription}`);
};
