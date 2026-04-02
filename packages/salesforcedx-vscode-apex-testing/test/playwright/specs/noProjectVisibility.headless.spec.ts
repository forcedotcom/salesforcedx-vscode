/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandDoesNotExist,
  isDesktop
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { emptyWorkspaceTest as test } from '../fixtures';

(isDesktop() ? test : test.skip.bind(test))(
  'Apex Testing commands are hidden when no project is open',
  async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    await test.step('verify all apex testing commands are hidden', async () => {
      // Open Apex Test Explorer Walkthrough
      await verifyCommandDoesNotExist(page, packageNls.apex_testing_walkthrough_open_command);

      // Run Apex Tests
      await verifyCommandDoesNotExist(page, packageNls.apex_test_run_text);

      // Run Apex Test Suite
      await verifyCommandDoesNotExist(page, packageNls.apex_test_suite_run_text);

      // Create Apex Test Suite
      await verifyCommandDoesNotExist(page, packageNls.apex_test_suite_create_text);

      // Add Tests to Apex Test Suite
      await verifyCommandDoesNotExist(page, packageNls.apex_test_suite_add_text);

      // Re-Run Last Run Apex Test Class
      await verifyCommandDoesNotExist(page, packageNls.apex_test_last_class_run_text);

      // Re-Run Last Run Apex Test Method
      await verifyCommandDoesNotExist(page, packageNls.apex_test_last_method_run_text);
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
