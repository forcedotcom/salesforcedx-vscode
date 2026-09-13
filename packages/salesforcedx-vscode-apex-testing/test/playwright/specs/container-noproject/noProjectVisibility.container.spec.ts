/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the "no SFDX project open" visibility rule for the apex-testing commands. The
 * headless twin (noProjectVisibility.headless.spec.ts) opens a folder with no sfdx-project.json and
 * asserts every apex-testing command is hidden. This proves the same gate holds inside the Code
 * Builder image.
 *
 * Runs against the NON-project workspace shape: the orchestrator opens the standard DX fixture first
 * (for ./specs/container), then re-seeds coder.json to the container-noproject mount + restarts and
 * runs THIS suite (test:container:noproject). It re-runs the extension verify gate after that
 * restart, so reaching a spec here means the apex-testing extension IS installed — a command missing
 * from the palette is the project gate hiding it, not a failure to load the extension.
 */

import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandDoesNotExist
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

test('No project (Code Builder): apex testing commands are hidden', async ({ page }) => {
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
});
