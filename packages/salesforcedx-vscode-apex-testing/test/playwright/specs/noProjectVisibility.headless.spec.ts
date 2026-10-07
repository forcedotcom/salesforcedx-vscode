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
import { isContainer, sharedEmptyWorkspaceTest as test } from '../fixtures';

// This spec runs against the NON-project workspace shape in container mode (Code Builder).
// The orchestrator re-seeds coder.json to the container-noproject mount, restarts,
// and runs this spec via isContainer branching. Re-runs the extension verify gate after restart,
// so reaching here means the apex-testing extension IS installed — a command missing from
// the palette is the project gate hiding it, not a failure to load the extension.
(isDesktop() || isContainer ? test : test.skip.bind(test))(
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

      // Edit Apex Test Suite
      await verifyCommandDoesNotExist(page, packageNls.apex_test_suite_edit_text);

      // Re-Run Last Run Apex Test Class
      await verifyCommandDoesNotExist(page, packageNls.apex_test_last_class_run_text);

      // Re-Run Last Run Apex Test Method
      await verifyCommandDoesNotExist(page, packageNls.apex_test_last_method_run_text);
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
