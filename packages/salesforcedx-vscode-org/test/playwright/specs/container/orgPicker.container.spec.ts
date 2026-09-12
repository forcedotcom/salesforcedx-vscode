/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Code Builder container twin of orgPicker.desktop (see docs/adr/0022-code-builder-e2e-desktop-build-over-browser.md).
 *
 * FEASIBILITY SPIKE (W-23898526): this is the probe for the multi-org capability. The container image
 * boots ONE org (SF_ACCESS_TOKEN/INSTANCE_URL token injection, see codeBuilder/auth.ts). The orchestrator
 * additionally auths every alias in CB_EXTRA_ORG_ALIASES into the running container via `sf org login
 * sfdx-url` BEFORE the workbench restart (codeBuilderLocalE2E.ts authExtraOrgsIntoContainer). In CI that
 * env is set to `nonTrackingTestOrg` only for this package (.github/workflows/codeBuilderE2E.yml). The
 * single unknown this spec answers: does the in-container extension's org picker SURFACE that second org,
 * given it was authed after boot but before the restart re-activated the extension — WITHOUT a window
 * reload (which the web/code-server container can't do)?
 *
 * ALIAS vs USERNAME (important): the boot org is authed via token injection and gets NO `minimalTestOrg`
 * alias inside the container (same reason aliasList.container asserts only the table header). orgList.ts
 * renders a picker row / status-bar label as the org ALIAS when present, else the USERNAME. So the boot
 * org appears by USERNAME (resolved here from the host CLI), while nonTrackingTestOrg — authed with an
 * explicit `--alias` — appears by that alias. This spec therefore asserts the boot org by username and the
 * extra org by alias; asserting the literal `minimalTestOrg` alias would never pass in-container.
 *
 * Depends on the CB_EXTRA_ORG_ALIASES multi-org capability. Skips (rather than false-failing) when the
 * extra org isn't authed on the host — i.e. a local run without the multi-org setup.
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
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
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

// Shared persistent workbench: reset editor + notification state before each test rather than
// assuming a clean slate.
test.beforeEach(async ({ page }) => {
  await resetContainerWorkbench(page);
});

test('org extension (Code Builder): org picker surfaces the boot org AND the extra multi-org (nonTrackingTestOrg)', async ({
  page
}) => {
  // Switching the default org + restoring it are quick config writes; the generous budget only covers
  // slow container startup / async status-bar refresh, not org creation (there is none here).
  test.setTimeout(180_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // The boot org is unaliased in-container, so the picker/status bar show its USERNAME — resolve it from
  // the host CLI (the host authed both orgs). nonTrackingTestOrg keeps its alias in-container.
  const defaultOrgUsername = await resolveOrgUsername(MINIMAL_ORG_ALIAS).catch(() => undefined);
  const extraOrgAuthed = await resolveOrgUsername(NON_TRACKING_ORG_ALIAS).catch(() => undefined);

  // The multi-org capability is CI-only (CB_EXTRA_ORG_ALIASES, set for this package). Skip — never
  // false-fail — when the host lacks either org, i.e. a local run without the multi-org setup.
  test.skip(
    !defaultOrgUsername || !extraOrgAuthed,
    `multi-org probe needs both "${MINIMAL_ORG_ALIAS}" (boot) and "${NON_TRACKING_ORG_ALIAS}" (CB_EXTRA_ORG_ALIASES) authed on the host`
  );
  const bootOrgLabel = defaultOrgUsername!;

  await test.step('wait for workbench', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'orgPicker.container.01-ready.png');
  });

  // Gate on an always-present activation command so we don't get a false negative on slow startup.
  await test.step('verify extension-activated command is present', async () => {
    await verifyCommandExists(page, packageNls.org_login_web_authorize_org_text, 60_000);
  });

  // Track whether we actually switched, so the restore step is a no-op if the CORE proof failed before
  // the switch (the picker is then closed defensively below either way).
  let switchedToExtra = false;
  try {
    await test.step('org picker lists BOTH the boot org and nonTrackingTestOrg (core capability proof)', async () => {
      // The boot org is the default, so the status bar shows its username (not "No Default Org Set").
      await expectOrgPickerStatusBar(page, bootOrgLabel);
      await clickOrgPickerStatusBar(page, bootOrgLabel);
      // Both orgs must be listed in the same freshly-opened picker. The extra-org row is THE proof that
      // an org authed after boot (pre-restart) surfaces without a window reload.
      await expectOrgPickerListsOrg(page, bootOrgLabel);
      await expectOrgPickerListsOrg(page, NON_TRACKING_ORG_ALIAS);
      await saveScreenshot(page, 'orgPicker.container.02-both-orgs-listed.png');
    });

    await test.step('switch default org to nonTrackingTestOrg and assert it took', async () => {
      // Picker is still open from the step above; select the extra org row to set it as the default.
      await selectOrgInPicker(page, NON_TRACKING_ORG_ALIAS);
      switchedToExtra = true;
      // The TargetOrgRef watcher refreshes the status bar after the config write — no reload needed.
      await expectOrgPickerStatusBar(page, NON_TRACKING_ORG_ALIAS);
      await saveScreenshot(page, 'orgPicker.container.03-switched-to-extra.png');
    });
  } finally {
    // REQUIRED save/restore: this shared serial session must not be left with nonTrackingTestOrg as the
    // default, or later container specs run against the wrong org. Restore through the SAME picker UI.
    // Defensive Escape closes any picker left open by a failed assertion above.
    await page.keyboard.press('Escape').catch(() => {});
    if (switchedToExtra) {
      await test.step('restore default org back to the boot org', async () => {
        await clickOrgPickerStatusBar(page, NON_TRACKING_ORG_ALIAS);
        await selectOrgInPicker(page, bootOrgLabel);
        await expectOrgPickerStatusBar(page, bootOrgLabel);
        await saveScreenshot(page, 'orgPicker.container.04-restored-boot-org.png');
      });
    }
  }

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
