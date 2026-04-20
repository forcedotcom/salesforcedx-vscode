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
import { waitForTraceFlagStatusBar } from '../helpers';

test.describe.configure({ mode: 'serial', timeout: 180_000 });

const LOG_POLL_INTERVAL_SETTING = 'salesforcedx-vscode-apex-log.logPollIntervalSeconds';

test('Auto-collection: poll interval setting, trace flag triggers collector, disable via 0', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup minimal org auth', async () => {
    await setupMinimalOrgAndAuth(page);
    await closeSettingsTab(page);
    await ensureSecondarySideBarHidden(page);

    // Wait for apex-log to activate (status bar is hidden until orgId is set). Match either
    // state here — if a previous run left a trace flag on the org, the status bar will show
    // "Tracing until ..." instead of "No Tracing". The next block handles the cleanup.
    await waitForTraceFlagStatusBar(page, /No Tracing|Tracing until/, 90_000);

    // Clean up any leftover trace flag from a previous run. Otherwise this test cannot reach
    // its own "No Tracing" starting state, and the following steps that rely on
    // `editorHasSelection`/`sf:has_target_org` contexts have nothing to do with the failure —
    // it's pure test-isolation leakage.
    const activeTraceFlag = page.locator(APEX_TRACE_FLAG_STATUS_BAR).filter({ hasText: /Tracing until/ });
    if (await activeTraceFlag.isVisible({ timeout: 1000 }).catch(() => false)) {
      await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsDeleteForCurrentUser']);
      await waitForTraceFlagStatusBar(page, /No Tracing/, 60_000);
    }
  });

  await test.step('set logPollIntervalSeconds to 10', async () => {
    await upsertSettings(page, { [LOG_POLL_INTERVAL_SETTING]: '10' });
    // Best-effort extra close in case `upsertSettings`'s internal close missed.
    await closeSettingsTab(page);
    // Re-confirm apex-log is still ready after the settings round-trip — the `sf:has_target_org`
    // context key is what gates the command's when-clause, and the trace-flag status bar being
    // visible implies that context is set. The status bar can briefly re-render while the
    // extension re-reads config, so poll rather than a single `toBeVisible` wait.
    await waitForTraceFlagStatusBar(page, /No Tracing/, 60_000);
    await saveScreenshot(page, 'auto-collect.poll-interval-set.png');
  });

  await test.step('create trace flag for current user (triggers auto-collection when logs exist)', async () => {
    await verifyCommandExists(page, packageNls['apexLog.command.traceFlagsCreateForCurrentUser'], 60_000);
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsCreateForCurrentUser']);
    await expect(page.locator(APEX_TRACE_FLAG_STATUS_BAR).filter({ hasText: /Tracing until/ })).toBeVisible({
      timeout: 60_000
    });
    await saveScreenshot(page, 'auto-collect.trace-flag-created.png');
  });

  await test.step('set logPollIntervalSeconds to 0 to disable auto-collection', async () => {
    await upsertSettings(page, { [LOG_POLL_INTERVAL_SETTING]: '0' });
    await closeSettingsTab(page);
    await saveScreenshot(page, 'auto-collect.poll-disabled.png');
  });

  await test.step('cleanup: delete trace flag', async () => {
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsDeleteForCurrentUser']);
    await waitForTraceFlagStatusBar(page, /No Tracing/);
    await saveScreenshot(page, 'auto-collect.cleanup.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
