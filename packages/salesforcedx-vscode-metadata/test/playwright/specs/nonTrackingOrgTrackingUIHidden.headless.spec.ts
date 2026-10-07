/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers: a fresh non-tracking scratch org made the DEFAULT hides the source-tracking status bar
 * widget and the tracking UI commands (reset, view-changes). Overlaps
 * nonTrackingOrgTrackingCommandsHidden but keeps this twin's distinct UI-focus: the status-bar WIDGET
 * plus the reset/view-changes commands specifically.
 *
 * Container: the container boots a SOURCE-TRACKING org as its default, so — as with the
 * commands-hidden spec — this uses the multi-org capability (W-23898526): switch the DEFAULT to a
 * second, NON-tracking org (nonTrackingTestOrg, CB_EXTRA_ORG_ALIASES) via the status-bar picker,
 * assert the tracking UI is gone, then RESTORE the boot org as default (REQUIRED) so the shared serial
 * session is not contaminated — a genuinely different, container-specific mechanism, so it is
 * branched rather than unified.
 *
 * fixme (W-23898526, CONTAINER ONLY): the metadata extension's source-tracking status bar does NOT
 * re-evaluate when the default org is switched at runtime in the code-server container, so it keeps
 * polling the boot (tracking) org and never hides. Root cause: that widget reacts to default-org
 * changes only through the config-file watcher (services `watchConfigFiles` -> `FileChangePubSub` on
 * the GLOBAL ~/.sf/config.json). The org picker's OWN status bar updates because the org extension
 * performs the config write in-process; the metadata extension is a separate host and learns of the
 * switch only via that file-change event, which code-server does not deliver cross-extension for a
 * file outside the workspace. CI run 34544008449 proved this on the sibling commands-hidden spec:
 * `.not.toBeVisible({ timeout: 60_000 })` failed on all three attempts with the widget actively
 * refreshing the boot org's Remote/Local/Conflicts counts the whole time (a missing event, not lag).
 * The sibling nonTrackingOrgDeployRetrieve* specs PASS in the container because deploy/retrieve
 * re-resolve the target org fresh from config at command time, so only the reactive status-bar
 * refresh is affected. Fixing this needs a product change (metadata ext observing the org switch
 * without a reload) or a window reload, which code-server cannot do. Re-enable once the metadata
 * source-tracking widget refreshes on a runtime switch. Desktop/web are NOT fixme'd — they create a
 * fresh non-tracking org per run and never hit this cross-extension-host runtime-switch path.
 */

import { expect } from '@playwright/test';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createNonTrackingOrg,
  upsertScratchOrgAuthFieldsToSettings,
  upsertSettings,
  verifyCommandDoesNotExist,
  validateNoCriticalErrors,
  isDesktop,
  HUB_ORG_ALIAS,
  NON_TRACKING_ORG_ALIAS,
  ensureSecondarySideBarHidden,
  clickOrgPickerStatusBar,
  env,
  execAsync,
  expectOrgPickerListsOrg,
  expectOrgPickerStatusBar,
  MINIMAL_ORG_ALIAS,
  resetContainerWorkbench,
  saveScreenshot,
  selectOrgInPicker,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { CORE_CONFIG_SECTION, DEPLOY_ON_SAVE_ENABLED } from '../../../src/constants';
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
    if (isContainer) {
      test.setTimeout(180_000);
    }
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
      if (isContainer) {
        // The containerTest fixture already awaited workbench readiness before handing over `page`.
        await closeWelcomeTabs(page);
        await ensureSecondarySideBarHidden(page);
        await saveScreenshot(page, 'nonTrackingUIHidden.01-ready.png');
      } else {
        const createResult = await createNonTrackingOrg(isDesktop() ? NON_TRACKING_ORG_ALIAS : HUB_ORG_ALIAS);
        await waitForVSCodeWorkbench(page);
        await closeWelcomeTabs(page);
        await ensureSecondarySideBarHidden(page);
        await upsertScratchOrgAuthFieldsToSettings(page, createResult);

        // Disable deploy-on-save so test can control when deploys happen
        await upsertSettings(page, { [`${CORE_CONFIG_SECTION}.${DEPLOY_ON_SAVE_ENABLED}`]: 'false' });

        // Wait for connection to be established and org info to be populated
        // The status bar will only appear if tracksSource is true, so we wait for it to NOT appear
        // This ensures the org info has been refreshed and the context is set correctly
        const statusBarPage = new SourceTrackingStatusBarPage(page);

        // Wait up to 30 seconds for the connection to establish
        // If the status bar appears, it means tracking is enabled (test will fail)
        // If it doesn't appear, we know the org is correctly detected as non-tracking
        await expect(statusBarPage.statusBarItem).not.toBeVisible({ timeout: 30_000 });
      }
    });

    if (isContainer) {
      await test.step('verify extension-activated command is present', async () => {
        await verifyCommandExists(page, packageNls.sobjects_refresh, 60_000);
      });
    }

    let switchedToExtra = false;
    try {
      if (isContainer) {
        await test.step('switch default org to nonTrackingTestOrg and assert it took', async () => {
          await expectOrgPickerStatusBar(page, bootOrgLabel);
          await clickOrgPickerStatusBar(page, bootOrgLabel);
          await expectOrgPickerListsOrg(page, NON_TRACKING_ORG_ALIAS);
          await selectOrgInPicker(page, NON_TRACKING_ORG_ALIAS);
          switchedToExtra = true;
          await expectOrgPickerStatusBar(page, NON_TRACKING_ORG_ALIAS);
          await saveScreenshot(page, 'nonTrackingUIHidden.02-switched-to-nontracking.png');
        });
      }

      await test.step('verify status bar widget does not appear', async () => {
        const statusBarPage = new SourceTrackingStatusBarPage(page);
        // The status bar should not appear for non-tracking orgs. Desktop/web already verified this in
        // setup, but check again to be sure; the container widget was visible for the boot (tracking) org,
        // so waiting for it to leave here also confirms the org/context refresh completed.
        await expect(statusBarPage.statusBarItem).not.toBeVisible({ timeout: isContainer ? 60_000 : 5000 });
        if (isContainer) {
          await saveScreenshot(page, 'nonTrackingUIHidden.03-status-bar-hidden.png');
        }
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
            await clickOrgPickerStatusBar(page, NON_TRACKING_ORG_ALIAS);
            await selectOrgInPicker(page, bootOrgLabel);
            await expectOrgPickerStatusBar(page, bootOrgLabel);
            await saveScreenshot(page, 'nonTrackingUIHidden.04-restored-boot-org.png');
          });
        }
      }
    }

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
