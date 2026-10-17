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
 * Container: the container image boots a source-TRACKING scratch org (minimalTestOrg) as the default,
 * so we cannot assert "hidden" against it directly. Instead this leans on the multi-org capability
 * (W-23898526): switch the DEFAULT to a second, NON-tracking org (nonTrackingTestOrg,
 * CB_EXTRA_ORG_ALIASES) through the status-bar picker, then RESTORE the boot org as default so the
 * shared serial session is not contaminated (REQUIRED) — a genuinely different, container-specific
 * mechanism from desktop's per-run createNonTrackingOrg, so it is branched rather than unified.
 *
 * fixme (W-23898526, CONTAINER ONLY): the metadata extension's source-tracking status bar does NOT
 * re-evaluate when the default org is switched at runtime in the code-server container, so it keeps
 * polling the boot (tracking) org and never hides. Root cause: that widget reacts to default-org
 * changes only through the config-file watcher (services `watchConfigFiles` -> `FileChangePubSub` on
 * the GLOBAL ~/.sf/config.json). The org picker's OWN status bar updates because the org extension
 * performs the config write in-process; the metadata extension is a separate host and learns of the
 * switch only via that file-change event, which code-server does not deliver cross-extension for a
 * file outside the workspace. CI run 34544008449 proved this: `.not.toBeVisible({ timeout: 60_000 })`
 * failed on all three attempts with the widget actively refreshing the boot org's Remote/Local/
 * Conflicts counts the whole time (a missing event, not lag). The sibling
 * nonTrackingOrgDeployRetrieve* specs PASS in the container because deploy/retrieve re-resolve the
 * target org fresh from config at command time, so only the reactive status-bar refresh is affected.
 * Fixing this needs a product change (metadata ext observing the org switch without a reload) or a
 * window reload, which code-server cannot do. Re-enable once the metadata source-tracking widget
 * refreshes on a runtime switch. Desktop is NOT fixme'd — it creates a fresh non-tracking org per run
 * and never hits this cross-extension-host runtime-switch path.
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
  clickOrgPickerStatusBar,
  env,
  execAsync,
  expectOrgPickerListsOrg,
  expectOrgPickerStatusBar,
  MINIMAL_ORG_ALIAS,
  NON_TRACKING_ORG_ALIAS,
  resetContainerWorkbench,
  saveScreenshot,
  selectOrgInPicker
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
    if (isContainer) {
      // Switching + restoring the default org are quick config writes; the generous budget only covers
      // slow container startup and the async org/context refresh, not org creation (there is none here).
      test.setTimeout(180_000);
    }
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
      if (isContainer) {
        // The containerTest fixture already awaited workbench readiness before handing over `page`.
        await closeWelcomeTabs(page);
        await ensureSecondarySideBarHidden(page);
        await saveScreenshot(page, 'nonTrackingCommandsHidden.01-ready.png');
      } else {
        const createResult = await createNonTrackingOrg();
        await waitForVSCodeWorkbench(page);
        await closeWelcomeTabs(page);
        await ensureSecondarySideBarHidden(page);
        await upsertScratchOrgAuthFieldsToSettings(page, createResult);
      }
    });

    // Wait for extension activation: sobjects_refresh is gated on sf:project_opened only,
    // so its presence confirms the metadata extension is fully initialized before
    // we assert tracking commands are absent (avoids false passes on slow startup).
    await test.step('verify extension-activated commands are present', async () => {
      await verifyCommandExists(page, packageNls.sobjects_refresh, isContainer ? 60_000 : 30_000);
    });

    let switchedToExtra = false;
    try {
      if (isContainer) {
        await test.step('switch default org to nonTrackingTestOrg and assert it took', async () => {
          // Boot org is the default, so the status bar shows its username.
          await expectOrgPickerStatusBar(page, bootOrgLabel);
          await clickOrgPickerStatusBar(page, bootOrgLabel);
          await expectOrgPickerListsOrg(page, NON_TRACKING_ORG_ALIAS);
          await selectOrgInPicker(page, NON_TRACKING_ORG_ALIAS);
          switchedToExtra = true;
          await expectOrgPickerStatusBar(page, NON_TRACKING_ORG_ALIAS);
          await saveScreenshot(page, 'nonTrackingCommandsHidden.02-switched-to-nontracking.png');
        });
      }

      await test.step('verify source tracking status bar is not visible', async () => {
        // On the boot (tracking) org the status bar is visible in the container; switching to a
        // non-tracking default must remove it. Waiting for it to leave also confirms the org/context
        // refresh completed before we assert the tracking commands are gone (avoids a false pass on
        // stale, still-tracking context).
        const statusBar = new SourceTrackingStatusBarPage(page);
        await expect(statusBar.statusBarItem).not.toBeVisible({ timeout: isContainer ? 60_000 : 30_000 });
        if (isContainer) {
          await saveScreenshot(page, 'nonTrackingCommandsHidden.03-status-bar-hidden.png');
        }
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
            await clickOrgPickerStatusBar(page, NON_TRACKING_ORG_ALIAS);
            await selectOrgInPicker(page, bootOrgLabel);
            await expectOrgPickerStatusBar(page, bootOrgLabel);
            await saveScreenshot(page, 'nonTrackingCommandsHidden.04-restored-boot-org.png');
          });
        }
      }
    }

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
