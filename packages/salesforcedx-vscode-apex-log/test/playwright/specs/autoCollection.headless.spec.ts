/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';

import {
  APEX_TRACE_FLAG_STATUS_BAR,
  closeSettingsTab,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  saveScreenshot,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  upsertSettings,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';

const LOG_POLL_INTERVAL_SETTING = 'salesforcedx-vscode-apex-log.logPollIntervalSeconds';

test('Auto-collection: poll interval setting, trace flag triggers collector, disable via 0', async ({ page }) => {
  test.setTimeout(180_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup minimal org auth', async () => {
    await setupMinimalOrgAndAuth(page);
    await closeSettingsTab(page);
    await ensureSecondarySideBarHidden(page);
  });

  await test.step('set logPollIntervalSeconds to 10', async () => {
    await upsertSettings(page, { [LOG_POLL_INTERVAL_SETTING]: '10' });
    await saveScreenshot(page, 'auto-collect.poll-interval-set.png');
  });

  await test.step('create trace flag for current user (triggers auto-collection when logs exist)', async () => {
    await verifyCommandExists(page, packageNls['apexLog.command.traceFlagsCreateForCurrentUser'], 30_000);
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsCreateForCurrentUser']);
    await expect(page.locator(APEX_TRACE_FLAG_STATUS_BAR).filter({ hasText: /Tracing until/ })).toBeVisible({
      timeout: 60_000
    });
    await saveScreenshot(page, 'auto-collect.trace-flag-created.png');
  });

  await test.step('set logPollIntervalSeconds to 0 to disable auto-collection', async () => {
    await upsertSettings(page, { [LOG_POLL_INTERVAL_SETTING]: '0' });
    await saveScreenshot(page, 'auto-collect.poll-disabled.png');
  });

  await test.step('cleanup: delete trace flag', async () => {
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsDeleteForCurrentUser']);
    await expect(page.locator(APEX_TRACE_FLAG_STATUS_BAR).filter({ hasText: /No Tracing/ })).toBeVisible({
      timeout: 60_000
    });
    await saveScreenshot(page, 'auto-collect.cleanup.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
