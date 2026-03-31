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
  verifyCommandExists,
  isDesktop
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { noOrgTest } from '../fixtures';

(isDesktop() ? noOrgTest : noOrgTest.skip.bind(noOrgTest))(
  'Apex Testing commands visibility when project is open but no org is connected',
  async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    await noOrgTest.step('verify project-only commands are visible', async () => {
      // Open Apex Test Explorer Walkthrough should be visible with just a project
      await verifyCommandExists(page, packageNls.apex_testing_walkthrough_open_command, 60_000);
    });

    await noOrgTest.step('verify org-dependent commands are hidden', async () => {
      // Run Apex Tests requires an org
      await verifyCommandDoesNotExist(page, packageNls.apex_test_run_text);

      // Run Apex Test Suite requires an org
      await verifyCommandDoesNotExist(page, packageNls.apex_test_suite_run_text);

      // Create Apex Test Suite requires an org
      await verifyCommandDoesNotExist(page, packageNls.apex_test_suite_create_text);

      // Add Tests to Apex Test Suite requires an org
      await verifyCommandDoesNotExist(page, packageNls.apex_test_suite_add_text);

      // Re-Run Last Run Apex Test Class requires an org
      await verifyCommandDoesNotExist(page, packageNls.apex_test_last_class_run_text);

      // Re-Run Last Run Apex Test Method requires an org
      await verifyCommandDoesNotExist(page, packageNls.apex_test_last_method_run_text);
    });

    await validateNoCriticalErrors(noOrgTest, consoleErrors, networkErrors);
  }
);
