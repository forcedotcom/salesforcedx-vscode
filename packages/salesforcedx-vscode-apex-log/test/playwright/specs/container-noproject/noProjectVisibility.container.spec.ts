/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the "no SFDX project open" visibility rule for the apex-log commands. The
 * headless twin (noProjectVisibility.headless.spec.ts) opens a folder with no sfdx-project.json and
 * asserts every apex-log command is hidden. This proves the same gate holds inside the Code Builder
 * image.
 *
 * Runs against the NON-project workspace shape: the orchestrator opens the standard DX fixture first
 * (for ./specs/container), then re-seeds coder.json to the container-noproject mount + restarts and
 * runs THIS suite (test:container:noproject). It re-runs the extension verify gate after that
 * restart, so reaching a spec here means the apex-log extension IS installed — a command missing from
 * the palette is the project gate hiding it, not a failure to load the extension.
 */

import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandDoesNotExist
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

test('No project (Code Builder): apex log commands are hidden', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('verify all apex log commands are hidden', async () => {
    // Moved template commands
    await verifyCommandDoesNotExist(page, packageNls.apex_generate_class_text);
    await verifyCommandDoesNotExist(page, packageNls.apex_generate_trigger_text);

    // Create Anonymous Apex Script
    await verifyCommandDoesNotExist(page, packageNls['apexLog.command.createAnonymousApexScript']);

    // Get Apex Debug Logs
    await verifyCommandDoesNotExist(page, packageNls['apexLog.command.logGet']);

    // Open Trace Flags
    await verifyCommandDoesNotExist(page, packageNls['apexLog.command.traceFlagsOpen']);

    // Execute Anonymous Apex (Document)
    await verifyCommandDoesNotExist(page, packageNls['apexLog.command.executeDocument']);

    // Execute Anonymous Apex (Selection)
    await verifyCommandDoesNotExist(page, packageNls['apexLog.command.executeSelection']);

    // Trace Flag commands
    await verifyCommandDoesNotExist(page, packageNls['apexLog.command.traceFlagsCreateForCurrentUser']);
    await verifyCommandDoesNotExist(page, packageNls['apexLog.command.traceFlagsDeleteForCurrentUser']);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
