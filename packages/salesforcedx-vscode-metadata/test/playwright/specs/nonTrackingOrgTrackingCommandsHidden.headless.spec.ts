/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers: when the DEFAULT org has NO source tracking, every source-tracking command (push/pull,
 * view-changes, reset) and the tracking status bar are hidden.
 *
 * Desktop's fixture opens with a fresh non-tracking org as the default. The container boots a
 * source-TRACKING org as its default, so it uses the multi-org capability (W-23898526): switch the
 * DEFAULT to the second, NON-tracking org (nonTrackingTestOrg, CB_EXTRA_ORG_ALIASES) via the status-bar
 * picker and RESTORE the boot org afterwards (REQUIRED) so the shared serial session is not
 * contaminated. Everything between is shared. The container skips (never false-fails) when the extra
 * org isn't authed.
 *
 * fixme (W-23898526, CONTAINER ONLY): after a runtime switch to the non-tracking org, the metadata
 * extension's source-tracking status bar never hides. It keeps showing tracking counts, so
 * `.not.toBeVisible({ timeout: 60_000 })` fails. Seen in CI run 34544008449 (all three attempts) and
 * reproduced locally on 2026-10-27 with the switch itself confirmed in the org picker. Desktop never
 * switches at runtime, so it is unaffected. The sibling nonTrackingOrgDeployRetrieve* specs pass in the
 * container because deploy/retrieve resolve the target org at command time. Re-enable once the widget
 * reacts to a runtime default-org switch.
 */

import { expect } from '@playwright/test';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createNonTrackingOrg,
  upsertScratchOrgAuthFieldsToSettings,
  verifyCommandExists,
  verifyCommandDoesNotExist,
  validateNoCriticalErrors,
  ensureSecondarySideBarHidden,
  isDesktop,
  env,
  execAsync,
  expectOrgPickerStatusBar,
  MINIMAL_ORG_ALIAS,
  NON_TRACKING_ORG_ALIAS,
  resetContainerWorkbench,
  saveScreenshot,
  switchDefaultOrgViaPicker
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
  // Shared persistent workbench: reset editor + notification state before each test rather than
  // assuming a clean slate.
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
}

// Container is fixme'd (see file-header rationale); desktop runs normally; plain web mode skips (no
// non-tracking mechanism there).
(isContainer ? test.fixme.bind(test) : isDesktop() ? test : test.skip.bind(test))(
  'Non-Tracking Org: source tracking commands and status bar hidden',
  async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    let bootOrgLabel = '';
    if (isContainer) {
      // Boot org is unaliased in-container, so the picker/status bar show its USERNAME (resolve from
      // host CLI); nonTrackingTestOrg keeps its alias in-container.
      const bootOrgUsername = await resolveOrgUsername(MINIMAL_ORG_ALIAS).catch(() => undefined);
      const extraOrgAuthed = await resolveOrgUsername(NON_TRACKING_ORG_ALIAS).catch(() => undefined);

      // The multi-org capability is CI-only (CB_EXTRA_ORG_ALIASES, set for this package). Skip — never
      // false-fail — when the host lacks either org, i.e. a local run without the multi-org setup.
      test.skip(
        !bootOrgUsername || !extraOrgAuthed,
        `needs both "${MINIMAL_ORG_ALIAS}" (boot) and "${NON_TRACKING_ORG_ALIAS}" (CB_EXTRA_ORG_ALIASES) authed on the host`
      );
      bootOrgLabel = bootOrgUsername!;
    }

    await test.step('setup', async () => {
      // The container's fixture already awaited the workbench, and its boot org is already authed.
      const createResult = isContainer ? undefined : await createNonTrackingOrg();
      if (!isContainer) {
        await waitForVSCodeWorkbench(page);
      }
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      if (createResult) {
        await upsertScratchOrgAuthFieldsToSettings(page, createResult);
      }
      await saveScreenshot(page, 'nonTrackingCommandsHidden.01-ready.png');
    });

    // sobjects_refresh is gated on sf:project_opened && sf:has_target_org, so its presence confirms the
    // metadata extension activated and has an org before we assert tracking commands are absent (avoids
    // a false pass on slow startup).
    await test.step('verify extension-activated commands are present', async () => {
      await verifyCommandExists(page, packageNls.sobjects_refresh, 60_000);
    });

    let switchedToExtra = false;
    try {
      if (isContainer) {
        await test.step('switch default org to nonTrackingTestOrg and assert it took', async () => {
          // Boot org is the default, so the status bar shows its username.
          await expectOrgPickerStatusBar(page, bootOrgLabel);
          // Re-drives the picker if the status-bar switch doesn't take (container config-watcher race).
          switchedToExtra = true;
          await switchDefaultOrgViaPicker(page, {
            fromLabel: bootOrgLabel,
            filterText: NON_TRACKING_ORG_ALIAS,
            expectLabel: NON_TRACKING_ORG_ALIAS,
            assertListsOrg: NON_TRACKING_ORG_ALIAS
          });
          await saveScreenshot(page, 'nonTrackingCommandsHidden.02-switched-to-nontracking.png');
        });
      }

      await test.step('verify source tracking status bar is not visible', async () => {
        // On the boot (tracking) org the status bar is visible in the container; switching to a
        // non-tracking default must remove it. Waiting for it to leave also confirms the org/context
        // refresh completed before we assert the tracking commands are gone (avoids a false pass on
        // stale, still-tracking context).
        const statusBar = new SourceTrackingStatusBarPage(page);
        await expect(statusBar.statusBarItem).not.toBeVisible({ timeout: 60_000 });
        await saveScreenshot(page, 'nonTrackingCommandsHidden.03-status-bar-hidden.png');
      });

      await test.step('verify push/pull and view-changes commands do not exist', async () => {
        await verifyCommandDoesNotExist(page, packageNls.project_deploy_start_default_org_text);
        await verifyCommandDoesNotExist(page, packageNls.project_deploy_start_ignore_conflicts_default_org_text);
        await verifyCommandDoesNotExist(page, packageNls.project_retrieve_start_default_org_text);
        await verifyCommandDoesNotExist(page, packageNls.project_retrieve_start_ignore_conflicts_default_org_text);
        await verifyCommandDoesNotExist(page, packageNls.view_all_changes_text);
        await verifyCommandDoesNotExist(page, packageNls.view_local_changes_text);
        await verifyCommandDoesNotExist(page, packageNls.view_remote_changes_text);
        await verifyCommandDoesNotExist(page, packageNls.reset_remote_tracking_text);
      });
    } finally {
      if (isContainer) {
        // REQUIRED save/restore: this shared serial session must not be left with nonTrackingTestOrg as
        // the default, or later container specs run against the wrong org. Restore through the SAME
        // picker UI. Defensive Escape closes any picker left open by a failed assertion above.
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
            await saveScreenshot(page, 'nonTrackingCommandsHidden.04-restored-boot-org.png');
          });
        }
      }
    }

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
