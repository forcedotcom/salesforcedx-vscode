/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the "project open but NO org connected" visibility rule for the apex-log
 * commands. The headless twin (noOrgVisibility.headless.spec.ts) opens the DX project with no org
 * authenticated and asserts project-only commands stay visible while org-dependent commands (gated on
 * the `sf:has_target_org` context key) are hidden. This proves the same gate holds inside the Code
 * Builder image.
 *
 * Runs against the NO-ORG boot shape: after the org-authed phases, the orchestrator re-boots the
 * container org-less (no SF_ACCESS_TOKEN/INSTANCE_URL, so the image authenticates no org), re-seeds the
 * STANDARD DX fixture, re-swaps the extensions, restarts, and re-runs the extension verify gate before
 * this suite (test:container:noorg). Reaching a spec here therefore means the apex-log extension IS
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

test('No org (Code Builder): apex log project commands visible, org-gated commands hidden', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('verify project-only commands are visible', async () => {
    // Create Anonymous Apex Script should be visible with just a project
    await verifyCommandExists(page, packageNls['apexLog.command.createAnonymousApexScript'], 30_000);

    // Moved template commands should be visible with just a project
    await verifyCommandExists(page, packageNls.apex_generate_class_text, 30_000);
    await verifyCommandExists(page, packageNls.apex_generate_trigger_text, 30_000);
  });

  await test.step('verify org-dependent commands are hidden', async () => {
    // Get Apex Debug Logs requires an org
    await verifyCommandDoesNotExist(page, packageNls['apexLog.command.logGet']);

    // Open Trace Flags requires an org
    await verifyCommandDoesNotExist(page, packageNls['apexLog.command.traceFlagsOpen']);

    // Execute Anonymous Apex (Document) requires an org
    await verifyCommandDoesNotExist(page, packageNls['apexLog.command.executeDocument']);

    // Execute Anonymous Apex (Selection) requires an org
    await verifyCommandDoesNotExist(page, packageNls['apexLog.command.executeSelection']);

    // Trace Flag commands require an org
    await verifyCommandDoesNotExist(page, packageNls['apexLog.command.traceFlagsCreateForCurrentUser']);
    await verifyCommandDoesNotExist(page, packageNls['apexLog.command.traceFlagsDeleteForCurrentUser']);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
