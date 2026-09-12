/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Code Builder container twin of nonTrackingOrgTrackingUIHidden.headless.
 *
 * The twin makes a fresh non-tracking scratch org the DEFAULT and asserts the source-tracking status bar
 * widget and the tracking UI commands (reset, view-changes) are hidden. The container boots a SOURCE-
 * TRACKING org as its default, so — as with the commands-hidden twin — this spec uses the multi-org
 * capability (W-23898526): switch the DEFAULT to the second, NON-tracking org (nonTrackingTestOrg,
 * CB_EXTRA_ORG_ALIASES) via the status-bar picker, assert the tracking UI is gone, then RESTORE the boot
 * org as default (REQUIRED) so the shared serial session is not contaminated.
 *
 * Overlaps the commands-hidden twin but keeps the twin's distinct UI-focus: the status-bar WIDGET plus the
 * reset/view-changes commands. Depends on CB_EXTRA_ORG_ALIASES; skips (never false-fails) when the extra
 * org isn't authed on the host.
 */

import {
  clickOrgPickerStatusBar,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  env,
  execAsync,
  expectOrgPickerListsOrg,
  expectOrgPickerStatusBar,
  MINIMAL_ORG_ALIAS,
  NON_TRACKING_ORG_ALIAS,
  resetContainerWorkbench,
  saveScreenshot,
  selectOrgInPicker,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandDoesNotExist,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import { expect } from '@playwright/test';
import { SourceTrackingStatusBarPage } from '../../pages/sourceTrackingStatusBarPage';
import { containerTest as test } from '../../fixtures/containerFixtures';
import packageNls from '../../../../package.nls.json';

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

test.beforeEach(async ({ page }) => {
  await resetContainerWorkbench(page);
});

// fixme (W-23898526): the metadata extension's source-tracking status bar does NOT re-evaluate when the
// default org is switched at runtime in the code-server container, so it keeps polling the boot (tracking)
// org and never hides. Root cause: that widget reacts to default-org changes only through the config-file
// watcher (services `watchConfigFiles` -> `FileChangePubSub` on the GLOBAL ~/.sf/config.json). The org
// picker's OWN status bar updates because the org extension performs the config write in-process; the
// metadata extension is a separate host and learns of the switch only via that file-change event, which
// code-server does not deliver cross-extension for a file outside the workspace. CI run 34544008449 proved
// this: `.not.toBeVisible({ timeout: 60_000 })` failed on all three attempts with the widget actively
// refreshing the boot org's Remote/Local/Conflicts counts the whole time (a missing event, not lag). The
// sibling nonTrackingOrgDeployRetrieve* container specs PASS because deploy/retrieve re-resolve the target
// org fresh from config at command time, so only the reactive status-bar refresh is affected. Fixing this
// needs a product change (metadata ext observing the org switch without a reload) or a window reload, which
// code-server cannot do. Re-enable once the metadata source-tracking widget refreshes on a runtime switch.
test.fixme('Non-Tracking Org (Code Builder): tracking UI elements are hidden', async ({ page }) => {
  test.setTimeout(180_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const bootOrgUsername = await resolveOrgUsername(MINIMAL_ORG_ALIAS).catch(() => undefined);
  const extraOrgAuthed = await resolveOrgUsername(NON_TRACKING_ORG_ALIAS).catch(() => undefined);

  test.skip(
    !bootOrgUsername || !extraOrgAuthed,
    `needs both "${MINIMAL_ORG_ALIAS}" (boot) and "${NON_TRACKING_ORG_ALIAS}" (CB_EXTRA_ORG_ALIASES) authed on the host`
  );
  const bootOrgLabel = bootOrgUsername!;

  await test.step('workbench ready', async () => {
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'nonTrackingUIHidden.container.01-ready.png');
  });

  await test.step('verify extension-activated command is present', async () => {
    await verifyCommandExists(page, packageNls.sobjects_refresh, 60_000);
  });

  let switchedToExtra = false;
  try {
    await test.step('switch default org to nonTrackingTestOrg and assert it took', async () => {
      await expectOrgPickerStatusBar(page, bootOrgLabel);
      await clickOrgPickerStatusBar(page, bootOrgLabel);
      await expectOrgPickerListsOrg(page, NON_TRACKING_ORG_ALIAS);
      await selectOrgInPicker(page, NON_TRACKING_ORG_ALIAS);
      switchedToExtra = true;
      await expectOrgPickerStatusBar(page, NON_TRACKING_ORG_ALIAS);
      await saveScreenshot(page, 'nonTrackingUIHidden.container.02-switched-to-nontracking.png');
    });

    await test.step('source tracking status bar widget does not appear for the non-tracking org', async () => {
      // On the boot (tracking) org the widget is visible; switching to a non-tracking default must remove
      // it. Waiting for it to leave also confirms the org/context refresh completed.
      const statusBar = new SourceTrackingStatusBarPage(page);
      await expect(statusBar.statusBarItem).not.toBeVisible({ timeout: 60_000 });
      await saveScreenshot(page, 'nonTrackingUIHidden.container.03-status-bar-hidden.png');
    });

    await test.step('reset tracking command does not exist', async () => {
      await verifyCommandDoesNotExist(page, packageNls.reset_remote_tracking_text);
    });

    await test.step('view changes commands do not exist', async () => {
      await verifyCommandDoesNotExist(page, packageNls.view_all_changes_text);
      await verifyCommandDoesNotExist(page, packageNls.view_local_changes_text);
      await verifyCommandDoesNotExist(page, packageNls.view_remote_changes_text);
    });
  } finally {
    await page.keyboard.press('Escape').catch(() => {});
    if (switchedToExtra) {
      await test.step('restore default org back to the boot org', async () => {
        await clickOrgPickerStatusBar(page, NON_TRACKING_ORG_ALIAS);
        await selectOrgInPicker(page, bootOrgLabel);
        await expectOrgPickerStatusBar(page, bootOrgLabel);
        await saveScreenshot(page, 'nonTrackingUIHidden.container.04-restored-boot-org.png');
      });
    }
  }

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
