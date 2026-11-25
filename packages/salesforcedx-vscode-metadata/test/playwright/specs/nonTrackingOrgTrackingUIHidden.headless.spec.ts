/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers: a non-tracking org as the DEFAULT hides the source-tracking status bar widget and the
 * tracking UI commands (reset, view-changes). Overlaps nonTrackingOrgTrackingCommandsHidden but keeps
 * this twin's distinct UI-focus: the status-bar WIDGET plus the reset/view-changes commands
 * specifically.
 *
 * Desktop and web create a fresh non-tracking org as the default. The container boots a
 * source-TRACKING org as its default, so it switches the DEFAULT to the second, NON-tracking org
 * (nonTrackingTestOrg, CB_EXTRA_ORG_ALIASES) via the status-bar picker and RESTORES the boot org
 * afterwards (REQUIRED). Everything between is shared. The container skips (never false-fails) when
 * the extra org isn't authed.
 *
 * fixme (W-23898526, CONTAINER ONLY): same status-bar failure as nonTrackingOrgTrackingCommandsHidden
 * (see its header): after the runtime switch the widget keeps showing tracking counts and never hides.
 * Reproduced locally for this spec on 2026-10-27.
 */

import { expect } from '@playwright/test';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createNonTrackingOrg,
  upsertScratchOrgAuthFieldsToSettings,
  verifyCommandDoesNotExist,
  validateNoCriticalErrors,
  isDesktop,
  HUB_ORG_ALIAS,
  NON_TRACKING_ORG_ALIAS,
  ensureSecondarySideBarHidden,
  env,
  execAsync,
  expectOrgPickerStatusBar,
  MINIMAL_ORG_ALIAS,
  resetContainerWorkbench,
  saveScreenshot,
  switchDefaultOrgViaPicker,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import packageNls from '../../../package.nls.json';
import { isContainer, sharedNonTrackingTest as test } from '../fixtures';

/** Resolve an org's username from the host CLI (the label the in-container picker shows for an unaliased org). */
const resolveOrgUsername = async (alias: string): Promise<string> => {
  const { stdout } = await execAsync(`sf org display -o ${alias} --json`, { env });
  const parsed = JSON.parse(stdout) as { result?: { username?: string } };
  const username = parsed.result?.username;
  if (!username) {
    throw new Error(`could not resolve username for org "${alias}" from \`sf org display\``);
  }
  return username;
};

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
}

// Container is fixme'd (see file-header rationale). Otherwise: we skip this on the web, locally,
// because your hub might not be aliased as 'hub'. It works without tracking, but there's no way to
// set that in the webfs auth files, even if it's set correctly locally. In CI, we use the devhub on
// the web.
(isContainer ? test.fixme.bind(test) : isDesktop() || process.env.CI ? test : test.skip.bind(test))(
  'Non-Tracking Org: tracking UI elements are hidden',
  async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    let bootOrgLabel = '';
    if (isContainer) {
      const bootOrgUsername = await resolveOrgUsername(MINIMAL_ORG_ALIAS).catch(() => undefined);
      const extraOrgAuthed = await resolveOrgUsername(NON_TRACKING_ORG_ALIAS).catch(() => undefined);

      test.skip(
        !bootOrgUsername || !extraOrgAuthed,
        `needs both "${MINIMAL_ORG_ALIAS}" (boot) and "${NON_TRACKING_ORG_ALIAS}" (CB_EXTRA_ORG_ALIASES) authed on the host`
      );
      bootOrgLabel = bootOrgUsername!;
    }

    await test.step('setup', async () => {
      // The container's fixture already awaited the workbench, and its boot org is already authed.
      const createResult = isContainer
        ? undefined
        : await createNonTrackingOrg(isDesktop() ? NON_TRACKING_ORG_ALIAS : HUB_ORG_ALIAS);
      if (!isContainer) {
        await waitForVSCodeWorkbench(page);
      }
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      if (createResult) {
        await upsertScratchOrgAuthFieldsToSettings(page, createResult);
      }
      await saveScreenshot(page, 'nonTrackingUIHidden.01-ready.png');
    });

    // sobjects_refresh is gated on sf:project_opened && sf:has_target_org, so its presence confirms the
    // metadata extension activated and has an org before we assert the tracking UI is absent (avoids a
    // false pass on slow startup).
    await test.step('verify extension-activated command is present', async () => {
      await verifyCommandExists(page, packageNls.sobjects_refresh, 60_000);
    });

    let switchedToExtra = false;
    try {
      if (isContainer) {
        await test.step('switch default org to nonTrackingTestOrg and assert it took', async () => {
          await expectOrgPickerStatusBar(page, bootOrgLabel);
          // Re-drives the picker if the status-bar switch doesn't take (container config-watcher race).
          switchedToExtra = true;
          await switchDefaultOrgViaPicker(page, {
            fromLabel: bootOrgLabel,
            filterText: NON_TRACKING_ORG_ALIAS,
            expectLabel: NON_TRACKING_ORG_ALIAS,
            assertListsOrg: NON_TRACKING_ORG_ALIAS
          });
          await saveScreenshot(page, 'nonTrackingUIHidden.02-switched-to-nontracking.png');
        });
      }

      await test.step('verify status bar widget does not appear', async () => {
        const statusBarPage = new SourceTrackingStatusBarPage(page);
        // The status bar should not appear for a non-tracking default. In the container the widget was
        // visible for the boot (tracking) org, so waiting for it to leave also confirms the org/context
        // refresh completed.
        await expect(statusBarPage.statusBarItem).not.toBeVisible({ timeout: 60_000 });
        await saveScreenshot(page, 'nonTrackingUIHidden.03-status-bar-hidden.png');
      });

      await test.step('verify reset tracking command does not exist', async () => {
        await verifyCommandDoesNotExist(page, packageNls.reset_remote_tracking_text);
      });

      await test.step('verify view changes commands do not exist', async () => {
        await verifyCommandDoesNotExist(page, packageNls.view_all_changes_text);
        await verifyCommandDoesNotExist(page, packageNls.view_local_changes_text);
        await verifyCommandDoesNotExist(page, packageNls.view_remote_changes_text);
      });
    } finally {
      if (isContainer) {
        await page.keyboard.press('Escape').catch(() => {});
        if (switchedToExtra) {
          await test.step('restore default org back to the boot org', async () => {
            // Re-drives the picker if the restore doesn't take, so the shared serial session isn't left
            // on nonTrackingTestOrg (which cascades into the next spec's pre-switch assertion).
            await switchDefaultOrgViaPicker(page, {
              fromLabel: NON_TRACKING_ORG_ALIAS,
              filterText: bootOrgLabel,
              expectLabel: bootOrgLabel
            });
            await saveScreenshot(page, 'nonTrackingUIHidden.04-restored-boot-org.png');
          });
        }
      }
    }

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
