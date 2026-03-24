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
  'Apex Log commands are hidden when no project is open',
  async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    await test.step('verify all apex log commands are hidden', async () => {
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
  }
);
