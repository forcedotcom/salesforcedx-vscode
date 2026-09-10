/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Code Builder container twin of orgPickers.desktop (see docs/adr/0022-code-builder-e2e-desktop-build-over-browser.md).
 *
 * The desktop twin exercises the three migrated org pickers (selectOrgForDisplay single-pick,
 * selectDeletableOrg multi-pick, orgLogoutAllCommand inline multi-pick) plus their cancel mappings,
 * AND performs REAL logout/logout-default against dedicated throwaway orgs it creates on the fly.
 *
 * Multi-org capability (W-23898526): the container now boots the tracking org (SF_ACCESS_TOKEN
 * injection) as the DEFAULT and the orchestrator additionally auths CB_EXTRA_ORG_ALIASES
 * (nonTrackingTestOrg in CI) into the running container before the workbench restart. That second org
 * is what makes these pickers meaningful in-container: they now enumerate TWO orgs, so "pick a
 * specific org from the list" is a real choice rather than a one-row rubber stamp.
 *
 * WHAT THIS PORTS (all non-destructive, safe for the shared serial session):
 *   - DISPLAY (single-pick): the picker lists BOTH orgs; picking the extra org shells
 *     `sf org display --target-org <picked>` and its username lands in the output channel — the proof
 *     that the picked (non-default) org drove the command.
 *   - DISPLAY / LOGOUT cancel: Esc on the picker maps to CANCEL (no error toast).
 *   - DELETE (multi-pick): the picker lists BOTH orgs; toggling the extra org + Enter reaches the
 *     confirm modal, which is Escaped (CANCEL) so NOTHING is deleted.
 *   - DELETE cancel: pick-nothing + Enter ([] empty array) maps to CANCEL.
 *   - LOGOUT (multi-pick): the picker lists BOTH orgs; toggle + Enter reaches the confirm modal,
 *     which is Escaped (CANCEL) so NOTHING is logged out.
 *
 * WHAT THIS OMITS (cannot run in the shared container — the honesty carve-out): the twin's REAL
 * logout / logout-default steps. Those need (a) `createThrowawayOrg` sacrificial orgs, which the
 * container cannot mint (no dev-hub-backed scratch creation inside the code-server image), and
 * (b) actually removing auth — which, against either of the two pre-provisioned orgs, would corrupt
 * the shared serial session that every later container spec depends on. There is no third,
 * disposable org to sacrifice, so the destructive removeAuth paths are intentionally not ported.
 *
 * ALIAS vs USERNAME: the boot org is token-authed and carries NO alias in-container, so it surfaces
 * by USERNAME (resolved here from the host CLI); nonTrackingTestOrg was authed with `--alias`, so it
 * surfaces by that alias. Same rationale as orgPicker.container / aliasList.container.
 *
 * Skips (never false-fails) when the host lacks either org — i.e. a local run without the multi-org
 * setup (CB_EXTRA_ORG_ALIASES is CI-only, set for this package).
 */

import { expect, type Page } from '@playwright/test';
import {
  activeQuickInputWidget,
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  env,
  execAsync,
  executeCommandWithCommandPalette,
  expectOrgPickerListsOrg,
  MINIMAL_ORG_ALIAS,
  NON_TRACKING_ORG_ALIAS,
  NOTIFICATION_LIST_ITEM,
  QUICK_INPUT_LIST_ROW,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  selectOrgInPicker,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { containerTest as test } from '../../fixtures/containerFixtures';
import packageNls from '../../../../package.nls.json';

// `channel_name` from salesforcedx-vscode-org/src/messages/i18n.ts (orgDisplay writes its table here).
const ORG_OUTPUT_CHANNEL = 'Salesforce Org Management';

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

/** Toggle a `canPickMany` quick-pick row's checkbox by typing the label and clicking the matching org row. */
const toggleMultiPickRow = async (page: Page, label: string): Promise<void> => {
  await page.keyboard.type(label);
  const row = activeQuickInputWidget(page)
    .locator(QUICK_INPUT_LIST_ROW)
    .filter({ hasText: label })
    .filter({ hasNotText: 'SFDX:' })
    .first();
  await row.waitFor({ state: 'visible', timeout: 10_000 });
  await row.click({ force: true });
};

/** Assert no error toast surfaced (UserCancellationError must map to CANCEL, never an error notification). */
const expectNoErrorNotification = async (page: Page): Promise<void> => {
  await expect(
    page.locator(NOTIFICATION_LIST_ITEM).filter({ has: page.locator('.codicon-error') }),
    'a CANCEL flow must not surface an error notification'
  ).toHaveCount(0);
};

// Shared persistent workbench: reset editor + notification state before each test rather than
// assuming a clean slate.
test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('org extension (Code Builder): migrated pickers enumerate BOTH orgs across display/delete/logout (non-destructive)', async ({
  page
}) => {
  // Generous budget for slow container startup + several cold sf shell-outs; no org creation here.
  test.setTimeout(180_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Boot org is unaliased in-container -> pickers show its USERNAME; nonTrackingTestOrg keeps its alias.
  const bootOrgUsername = await resolveOrgUsername(MINIMAL_ORG_ALIAS).catch(() => undefined);
  const extraOrgUsername = await resolveOrgUsername(NON_TRACKING_ORG_ALIAS).catch(() => undefined);

  // The multi-org capability is CI-only (CB_EXTRA_ORG_ALIASES). Skip — never false-fail — when the
  // host lacks either org, i.e. a local run without the multi-org setup.
  test.skip(
    !bootOrgUsername || !extraOrgUsername,
    `multi-org port needs both "${MINIMAL_ORG_ALIAS}" (boot) and "${NON_TRACKING_ORG_ALIAS}" (CB_EXTRA_ORG_ALIASES) authed on the host`
  );
  const bootOrgLabel = bootOrgUsername!;
  const extraOrgUsernameValue = extraOrgUsername!;

  await test.step('wait for workbench', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'orgPickers.container.01-ready.png');
  });

  // Gate on an always-present activation command so we don't false-negative on slow startup.
  await test.step('verify extension is activated', async () => {
    await verifyCommandExists(page, packageNls.org_login_web_authorize_org_text, 60_000);
  });

  await test.step('DISPLAY: selectOrgForDisplay lists BOTH orgs; pick the extra org, assert its username in output', async () => {
    await executeCommandWithCommandPalette(page, packageNls.org_display_username_text);
    // Multi-org proof: the single-pick display picker enumerates both authed orgs.
    await expectOrgPickerListsOrg(page, bootOrgLabel);
    await expectOrgPickerListsOrg(page, NON_TRACKING_ORG_ALIAS);
    await saveScreenshot(page, 'orgPickers.container.02-display-both-listed.png');
    // Pick the NON-default extra org; orgDisplay shells `sf org display --target-org <picked> --json`.
    await selectOrgInPicker(page, NON_TRACKING_ORG_ALIAS);
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, ORG_OUTPUT_CHANNEL, 30_000);
    // The picked (extra) org's username in the rendered table proves the picked org — not the default —
    // drove the display round-trip.
    await waitForOutputChannelText(page, { expectedText: extraOrgUsernameValue, timeout: 60_000 });
    await saveScreenshot(page, 'orgPickers.container.03-display-extra-username.png');
  });

  await test.step('DISPLAY cancel: Esc on the picker maps to CANCEL (no error toast)', async () => {
    await executeCommandWithCommandPalette(page, packageNls.org_display_username_text);
    await expectOrgPickerListsOrg(page, NON_TRACKING_ORG_ALIAS);
    await page.keyboard.press('Escape');
    await expect(page.locator(QUICK_INPUT_WIDGET)).toBeHidden({ timeout: 10_000 });
    await expectNoErrorNotification(page);
  });

  await test.step('DELETE: selectDeletableOrg multi-pick lists BOTH orgs, toggle extra, then Esc-cancel the confirm', async () => {
    await executeCommandWithCommandPalette(page, packageNls.org_delete_username_text);
    await expectOrgPickerListsOrg(page, bootOrgLabel);
    await expectOrgPickerListsOrg(page, NON_TRACKING_ORG_ALIAS);
    // Toggle the extra org row (canPickMany), accept to reach the confirm modal, then CANCEL it so
    // NOTHING is deleted (non-destructive against the shared session).
    await toggleMultiPickRow(page, NON_TRACKING_ORG_ALIAS);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await expectNoErrorNotification(page);
  });

  await test.step('DELETE cancel: multi-pick pick-nothing + Enter ([] empty array) maps to CANCEL', async () => {
    await executeCommandWithCommandPalette(page, packageNls.org_delete_username_text);
    await expectOrgPickerListsOrg(page, NON_TRACKING_ORG_ALIAS);
    // Accept with nothing selected -> [] -> empty-array guard -> CANCEL (no confirm modal).
    await page.keyboard.press('Enter');
    await expect(page.locator(QUICK_INPUT_WIDGET)).toBeHidden({ timeout: 10_000 });
    await expectNoErrorNotification(page);
  });

  await test.step('LOGOUT: orgLogoutAllCommand multi-pick lists BOTH orgs, toggle extra, then Esc-cancel the confirm', async () => {
    await executeCommandWithCommandPalette(page, packageNls.org_logout_all_text);
    await expectOrgPickerListsOrg(page, bootOrgLabel);
    await expectOrgPickerListsOrg(page, NON_TRACKING_ORG_ALIAS);
    await toggleMultiPickRow(page, NON_TRACKING_ORG_ALIAS);
    await page.keyboard.press('Enter');
    // CANCEL the confirm modal so NO org is logged out (removeAuth must not run against a shared org).
    await page.keyboard.press('Escape');
    await expectNoErrorNotification(page);
  });

  await test.step('LOGOUT cancel: Esc on the picker maps to CANCEL', async () => {
    await executeCommandWithCommandPalette(page, packageNls.org_logout_all_text);
    await expectOrgPickerListsOrg(page, NON_TRACKING_ORG_ALIAS);
    await page.keyboard.press('Escape');
    await expect(page.locator(QUICK_INPUT_WIDGET)).toBeHidden({ timeout: 10_000 });
    await expectNoErrorNotification(page);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
