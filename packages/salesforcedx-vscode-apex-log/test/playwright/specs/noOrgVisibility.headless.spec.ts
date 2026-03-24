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
import { test } from '../fixtures';

(isDesktop() ? test : test.skip.bind(test))(
  'Apex Log commands visibility when project is open but no org is connected',
  async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    await test.step('verify project-only commands are visible', async () => {
      // Create Anonymous Apex Script should be visible with just a project
      await verifyCommandExists(page, packageNls['apexLog.command.createAnonymousApexScript'], 30_000);
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
  }
);
