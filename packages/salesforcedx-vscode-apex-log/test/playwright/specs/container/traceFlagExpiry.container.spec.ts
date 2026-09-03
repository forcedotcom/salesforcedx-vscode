/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for automatic trace-flag expiry. The web twin
 * (traceFlagExpiry.headless.spec.ts) exercises the flow against a plain Page; this proves the
 * status-bar tick clears a naturally-expired trace flag against the container's boot-authed org,
 * with a live trace flag that actually expires org-side — which web mode cannot cover.
 *
 * This spec mutates the org-global current-user trace flag and the default-duration setting. The
 * container config runs workers:1 serially, so exclusive access holds; the afterEach removes what it
 * created and restores the setting.
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
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';
import { waitForTraceFlagStatusBar } from '../../helpers';

const DURATION_SETTING = 'salesforcedx-vscode-apex-log.traceFlagsDefaultDurationMinutes';

// Shared persistent workbench: reset editors + notifications between specs.
test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

// Self-clean: remove any lingering trace flag and restore the default-duration setting so later specs
// on the shared workbench do not inherit the 1-minute expiry.
test.afterEach(async ({ page }) => {
  await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsDeleteForCurrentUser']).catch(
    () => {}
  );
  await upsertSettings(page, { [DURATION_SETTING]: '30' }).catch(() => {});
  await closeSettingsTab(page).catch(() => {});
});

test('Trace flag status bar clears automatically at natural expiry (Code Builder, no manual delete)', async ({
  page
}) => {
  // Budget: flag expires ~60s after creation (1-min duration); the status-bar tick fires on the next
  // Schedule.fixed(1 min) boundary, so worst case ~120s after the prior tick. 150s poll covers boundary
  // misalignment. The cleanup scheduler (every 5 min) cannot fire inside this window, so a pass proves
  // the status-bar tick — not cleanup — cleared the footer.
  test.setTimeout(4 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
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
    await saveScreenshot(page, 'traceFlagExpiry.container.01-ready.png');
  });

  await test.step('set default trace flag duration to 1 minute (shortest natural expiry)', async () => {
    await upsertSettings(page, { [DURATION_SETTING]: '1' });
    await closeSettingsTab(page);
    await waitForTraceFlagStatusBar(page, /No Tracing/, 60_000);
    await saveScreenshot(page, 'traceFlagExpiry.container.02-duration-set.png');
  });

  await test.step('create trace flag for current user', async () => {
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsCreateForCurrentUser']);
    await expect(page.locator(APEX_TRACE_FLAG_STATUS_BAR).filter({ hasText: /Tracing until/ })).toBeVisible({
      timeout: 60_000
    });
    await saveScreenshot(page, 'traceFlagExpiry.container.03-created.png');
  });

  await test.step('status bar clears within ~1 min of expiry without delete or reload', async () => {
    // Do NOT delete — rely solely on the Phase 2 status-bar tick re-evaluating live isTraceFlagActive.
    await waitForTraceFlagStatusBar(page, /No Tracing/, 150_000);
    await saveScreenshot(page, 'traceFlagExpiry.container.04-cleared.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
