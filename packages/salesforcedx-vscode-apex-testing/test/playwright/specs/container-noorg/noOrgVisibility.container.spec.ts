/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the "project open but NO org connected" visibility rule for the apex-testing
 * commands. The headless twin (noOrgVisibility.headless.spec.ts) opens the DX project with no org
 * authenticated and asserts the walkthrough command stays visible while run/suite commands (gated on
 * the `sf:has_target_org` context key) are hidden. This proves the same gate holds inside the Code
 * Builder image.
 *
 * Runs against the NO-ORG boot shape: after the org-authed phases, the orchestrator re-boots the
 * container org-less (no SF_ACCESS_TOKEN/INSTANCE_URL, so the image authenticates no org), re-seeds the
 * STANDARD DX fixture, re-swaps the extensions, restarts, and re-runs the extension verify gate before
 * this suite (test:container:noorg). Reaching a spec here therefore means the apex-testing extension IS
 * installed — an org-gated command missing from the palette is the no-org gate hiding it, not a failure
 * to load the extension.
 */

import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandDoesNotExist,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

test('No org (Code Builder): apex testing walkthrough visible, org-gated commands hidden', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('verify project-only commands are visible', async () => {
    // Open Apex Test Explorer Walkthrough should be visible with just a project
    await verifyCommandExists(page, packageNls.apex_testing_walkthrough_open_command, 60_000);
  });

  await test.step('verify org-dependent commands are hidden', async () => {
    // Run Apex Tests requires an org
    await verifyCommandDoesNotExist(page, packageNls.apex_test_run_text);

    // Run Apex Test Suite requires an org
    await verifyCommandDoesNotExist(page, packageNls.apex_test_suite_run_text);

    // Create Apex Test Suite requires an org
    await verifyCommandDoesNotExist(page, packageNls.apex_test_suite_create_text);

    // Edit Apex Test Suite requires an org
    await verifyCommandDoesNotExist(page, packageNls.apex_test_suite_edit_text);

    // Re-Run Last Run Apex Test Class requires an org
    await verifyCommandDoesNotExist(page, packageNls.apex_test_last_class_run_text);

    // Re-Run Last Run Apex Test Method requires an org
    await verifyCommandDoesNotExist(page, packageNls.apex_test_last_method_run_text);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
