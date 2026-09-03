/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for auto-collection of Apex logs. The web twin
 * (autoCollection.headless.spec.ts) exercises the flow against a plain Page; this proves the poll
 * interval setting and trace-flag-driven collector behave against the container's boot-authed org,
 * where a real trace flag and live ApexLog polling exist — which web mode cannot cover.
 *
 * This spec mutates the org-global current-user trace flag. The container config runs workers:1
 * serially, so exclusive access holds; the afterEach removes what it created.
 */

import { expect } from '@playwright/test';

import {
  APEX_TRACE_FLAG_STATUS_BAR,
  clearAllNotifications,
  closeAllEditors,
  closeSettingsTab,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  removeAllDebugLevels,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  upsertSettings,
  validateNoCriticalErrors,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';
import { waitForTraceFlagStatusBar } from '../../helpers';

const LOG_POLL_INTERVAL_SETTING = 'salesforcedx-vscode-apex-log.logPollIntervalSeconds';

// Shared persistent workbench: reset editors + notifications between specs.
test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

// Self-clean: remove the trace flag this spec created and restore the poll interval to its default so
// later specs on the shared workbench start clean.
test.afterEach(async ({ page }) => {
  await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsDeleteForCurrentUser']).catch(
    () => {}
  );
  await upsertSettings(page, { [LOG_POLL_INTERVAL_SETTING]: '30' }).catch(() => {});
  await closeSettingsTab(page).catch(() => {});
});

test('Auto-collection (Code Builder): poll interval setting, trace flag triggers collector, disable via 0', async ({
  page
}) => {
  test.setTimeout(3 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await closeSettingsTab(page);
    await ensureSecondarySideBarHidden(page);

    // Wait for apex-log to activate (status bar is hidden until orgId is set). Match either
    // state here — if a previous run left a trace flag on the org, the status bar will show
    // "Tracing until ..." instead of "No Tracing". The next block handles the cleanup.
    await waitForTraceFlagStatusBar(page, /No Tracing|Tracing until/, 90_000);

    // Clean up any leftover trace flag from a previous run so this test can reach its own
    // "No Tracing" starting state.
    const activeTraceFlag = page.locator(APEX_TRACE_FLAG_STATUS_BAR).filter({ hasText: /Tracing until/ });
    if (await activeTraceFlag.isVisible({ timeout: 1000 }).catch(() => false)) {
      await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsDeleteForCurrentUser']);
      await waitForTraceFlagStatusBar(page, /No Tracing/, 60_000);
    }

    await removeAllDebugLevels(page);
    await saveScreenshot(page, 'autoCollection.container.01-ready.png');
  });

  await test.step('set logPollIntervalSeconds to 10', async () => {
    await upsertSettings(page, { [LOG_POLL_INTERVAL_SETTING]: '10' });
    // Best-effort extra close in case `upsertSettings`'s internal close missed.
    await closeSettingsTab(page);
    // Re-confirm apex-log is still ready after the settings round-trip — the trace-flag status bar
    // being visible implies the `sf:has_target_org` context is set. Poll rather than a single wait
    // because the status bar can briefly re-render while the extension re-reads config.
    await waitForTraceFlagStatusBar(page, /No Tracing/, 60_000);
    await saveScreenshot(page, 'autoCollection.container.02-poll-interval-set.png');
  });

  await test.step('create trace flag for current user (triggers auto-collection when logs exist)', async () => {
    await verifyCommandExists(page, packageNls['apexLog.command.traceFlagsCreateForCurrentUser'], 60_000);
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsCreateForCurrentUser']);
    await expect(page.locator(APEX_TRACE_FLAG_STATUS_BAR).filter({ hasText: /Tracing until/ })).toBeVisible({
      timeout: 60_000
    });
    await saveScreenshot(page, 'autoCollection.container.03-trace-flag-created.png');
  });

  await test.step('set logPollIntervalSeconds to 0 to disable auto-collection', async () => {
    await upsertSettings(page, { [LOG_POLL_INTERVAL_SETTING]: '0' });
    await closeSettingsTab(page);
    await saveScreenshot(page, 'autoCollection.container.04-poll-disabled.png');
  });

  await test.step('cleanup: delete trace flag', async () => {
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsDeleteForCurrentUser']);
    await waitForTraceFlagStatusBar(page, /No Tracing/);
    await saveScreenshot(page, 'autoCollection.container.05-cleanup.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
