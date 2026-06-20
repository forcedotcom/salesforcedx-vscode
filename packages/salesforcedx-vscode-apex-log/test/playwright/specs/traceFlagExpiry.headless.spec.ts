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
  removeAllDebugLevels,
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
import { waitForTraceFlagStatusBar } from '../helpers';

// Budget: flag expires ~60s after creation (1-min duration); the status-bar tick fires on the next
// Schedule.fixed(1 min) boundary, so worst case ~120s after the prior tick. 150s poll covers boundary
// misalignment. The cleanup scheduler (every 5 min) cannot fire inside this window, so a pass proves
// the status-bar tick — not cleanup — cleared the footer. Suite timeout sized for that wait + setup.
test.describe.configure({ mode: 'serial', timeout: 240_000 });

const DURATION_SETTING = 'salesforcedx-vscode-apex-log.traceFlagsDefaultDurationMinutes';

test('Trace flag status bar clears automatically at natural expiry (no manual delete)', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup minimal org auth', async () => {
    await setupMinimalOrgAndAuth(page);
    await closeSettingsTab(page);
    await ensureSecondarySideBarHidden(page);

    // Wait for apex-log to activate (status bar hidden until orgId is set). A previous run may have
    // left a trace flag, so match either state, then clean up below.
    await waitForTraceFlagStatusBar(page, /No Tracing|Tracing until/, 90_000);

    const activeTraceFlag = page.locator(APEX_TRACE_FLAG_STATUS_BAR).filter({ hasText: /Tracing until/ });
    if (await activeTraceFlag.isVisible({ timeout: 1000 }).catch(() => false)) {
      await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsDeleteForCurrentUser']);
      await waitForTraceFlagStatusBar(page, /No Tracing/, 60_000);
    }

    await removeAllDebugLevels(page);
  });

  await test.step('set default trace flag duration to 1 minute (shortest natural expiry)', async () => {
    await upsertSettings(page, { [DURATION_SETTING]: '1' });
    await closeSettingsTab(page);
    await waitForTraceFlagStatusBar(page, /No Tracing/, 60_000);
    await saveScreenshot(page, 'trace-flag-expiry.duration-set.png');
  });

  await test.step('create trace flag for current user', async () => {
    await verifyCommandExists(page, packageNls['apexLog.command.traceFlagsCreateForCurrentUser'], 60_000);
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsCreateForCurrentUser']);
    await expect(page.locator(APEX_TRACE_FLAG_STATUS_BAR).filter({ hasText: /Tracing until/ })).toBeVisible({
      timeout: 60_000
    });
    await saveScreenshot(page, 'trace-flag-expiry.created.png');
  });

  await test.step('status bar clears within ~1 min of expiry without delete or reload', async () => {
    // Do NOT delete — rely solely on the Phase 2 status-bar tick re-evaluating live isTraceFlagActive.
    await waitForTraceFlagStatusBar(page, /No Tracing/, 150_000);
    await saveScreenshot(page, 'trace-flag-expiry.cleared.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
