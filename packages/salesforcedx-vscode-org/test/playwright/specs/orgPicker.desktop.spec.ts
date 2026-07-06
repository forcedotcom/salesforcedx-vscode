/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  activeQuickInputTextField,
  activeQuickInputWidget,
  clickOrgPickerStatusBar,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  env,
  execAsync,
  expectOrgPickerActionItems,
  expectOrgPickerListsOrg,
  expectOrgPickerStatusBar,
  getTargetDevHub,
  QUICK_INPUT_LIST_ROW,
  selectOrgInPicker,
  selectQuickInputOptionByTyping,
  waitForNotification,
  waitForQuickInputFirstOption,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { orgDesktopTest as test } from '../fixtures/desktopFixtures';

// Tests the org-picker status bar item: no-org state, picker action items, set default org (dev hub),
// create a default scratch org, and switching the default org between dev hub and scratch.
// Setting a default org is no longer a commandlet (W-23250969): the picker writes config via
// ConfigService.setTargetOrg then refreshes the org ref via ConnectionService.getConnection, so there
// is no success toast and no output-channel table — the status bar is the user-facing signal.

// `missing_default_org` from `salesforcedx-vscode-org/src/messages/i18n.ts` (not in package.nls.json).
const NO_DEFAULT_ORG = 'No Default Org Set';
const CREATE_SCRATCH_ORG_RAN = /SFDX: Create a Default Scratch Org\.\.\. successfully ran/;

// The 5 ACTION_ITEMS rendered in the picker (orgList.ts ACTION_ITEMS); labels carry an icon prefix.
const PICKER_ACTION_ITEMS = [
  packageNls.org_login_web_authorize_org_text,
  packageNls.org_login_web_authorize_dev_hub_text,
  packageNls.org_create_default_scratch_org_text,
  packageNls.org_login_access_token_text,
  packageNls.org_list_clean_text
] as const;

test('org picker: set default org, create scratch org, switch default org', async ({ page }, testInfo) => {
  // Scratch org creation can take several minutes; allow generous headroom.
  test.setTimeout(720_000);

  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);

  // Initial state shows "No Default Org Set". Dev hub is already globally auth'd in CI
  // (orgE2E.yml --set-default-dev-hub); read its alias rather than re-authorizing via UI.
  const devHubAlias = await getTargetDevHub();
  await test.step('status bar shows No Default Org Set', async () => {
    await expectOrgPickerStatusBar(page, NO_DEFAULT_ORG);
  });

  // Open the picker via the status bar, verify the 5 action items, select the dev hub. The picker
  // writes config and refreshes the org ref within its own effect (no toast); the status bar is the
  // user-facing signal that the default org changed.
  await test.step('set dev hub as default org via picker', async () => {
    await clickOrgPickerStatusBar(page, NO_DEFAULT_ORG);
    await expectOrgPickerActionItems(page, PICKER_ACTION_ITEMS);
    await selectOrgInPicker(page, devHubAlias);
  });

  await test.step('status bar shows dev hub alias', async () => {
    await expectOrgPickerStatusBar(page, devHubAlias);
  });

  // Create a default scratch org via the picker's 3 prompts (def file, alias, days). Alias is
  // dynamic and captured for reuse; include the worker index + a random suffix so parallel workers
  // can never collide on the same timestamp.
  const scratchAlias = `TempScratchOrg_${Date.now()}_${testInfo.workerIndex}_${Math.random().toString(36).slice(2)}`;
  await test.step('create a default scratch org', async () => {
    await clickOrgPickerStatusBar(page, devHubAlias);
    await selectQuickInputOptionByTyping(page, packageNls.org_create_default_scratch_org_text);
    // Prompt 1: scratch-def file picker (workspace has exactly one config/*-scratch-def.json).
    // Wait for the file row to render, then commit with Enter (a row click alone only highlights).
    await waitForQuickInputFirstOption(page);
    await activeQuickInputWidget(page)
      .locator(QUICK_INPUT_LIST_ROW)
      .filter({ hasText: 'project-scratch-def.json' })
      .first()
      .waitFor({ state: 'visible', timeout: 30_000 });
    await page.keyboard.press('Enter');
    // Prompt 2: alias input box. orgCreate.ts pre-fills `value` with the sanitized workspace folder
    // name, so wait for that non-empty default to appear (proves the alias prompt rendered, not the
    // stale def-picker) before overwriting it. fill('', force) clears then types, reliable on CI.
    const input = activeQuickInputTextField(page);
    await expect(input, 'alias input box should show the pre-filled default after the file picker commits').toHaveValue(
      /.+/,
      { timeout: 30_000 }
    );
    await input.fill(scratchAlias, { force: true });
    await page.keyboard.press('Enter');
    // Prompt 3: expiration days input box, pre-filled with the DEFAULT_EXPIRATION_DAYS default.
    await expect(
      input,
      'expiration-days input box should show the pre-filled default after the alias commits'
    ).toHaveValue(/.+/, { timeout: 30_000 });
    await input.fill('1', { force: true });
    await page.keyboard.press('Enter');
  });

  // `--set-default` makes the new org the default. The migrated Effect command shows the
  // `... successfully ran` toast on completion (orgCreate.ts handleSuccess); wait for it (multi-minute
  // command), then assert the persistent status-bar signal.
  await test.step('scratch org create completes and is auto-set as default', async () => {
    await waitForNotification(page, CREATE_SCRATCH_ORG_RAN, { timeout: 600_000 });
    // The success notification signals the command finished; the status bar updates within seconds, so
    // a short timeout here keeps the two sequential waits from summing past the 720s test budget.
    await expectOrgPickerStatusBar(page, scratchAlias, { timeout: 30_000 });
  });

  // Switch default org back and forth. No window reload — `setDefaultOrg` re-reads auth state
  // from disk on every picker open (orgList.ts AuthInfo.listAllAuthorizations + disk aliases).
  await test.step('switch default org back to dev hub', async () => {
    await clickOrgPickerStatusBar(page, scratchAlias);
    // Staleness guard: confirm the freshly created scratch org appears without a reload.
    await expectOrgPickerListsOrg(page, scratchAlias);
    await selectOrgInPicker(page, devHubAlias);
    await expectOrgPickerStatusBar(page, devHubAlias);
  });

  await test.step('switch default org back to scratch org', async () => {
    await clickOrgPickerStatusBar(page, devHubAlias);
    await selectOrgInPicker(page, scratchAlias);
    await expectOrgPickerStatusBar(page, scratchAlias);
  });

  // Clean up the scratch org created above. Best-effort: the org auto-expires in 1 day and a
  // nightly cron sweeps leftovers, but deleting here avoids leaking a real org on every run.
  // Guarded so a delete failure doesn't fail a passing test.
  await test.step('delete the created scratch org', async () => {
    await execAsync(`sf org delete scratch --target-org ${scratchAlias} --no-prompt`, { env }).catch(
      (error: unknown) => {
        console.warn(`Failed to delete scratch org ${scratchAlias}; it will expire in 1 day. ${String(error)}`);
      }
    );
  });
});

// Cancelling at the scratch-def picker must be silent: no org created, no set-default, no success
// channel line. The migrated command's devhub gate bails BEFORE any picker when no dev hub is set, so
// the cancel path is only reachable once a default org is configured — set the dev hub as default
// first (mirrors the success test) to avoid a vacuous local pass.
test('org create: cancel at def-file picker is silent', async ({ page }) => {
  test.setTimeout(120_000);

  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);

  // getTargetDevHub throws when no dev hub is configured. Without one, the command bails at the devhub
  // gate before any picker, so the cancel path is unreachable — skip rather than pass vacuously.
  const maybeDevHubAlias = await getTargetDevHub().catch(() => undefined);
  test.skip(!maybeDevHubAlias, 'no dev hub configured; org-create cancel path is unreachable');
  const devHubAlias = maybeDevHubAlias!;

  await test.step('set dev hub as default org via picker', async () => {
    await clickOrgPickerStatusBar(page, NO_DEFAULT_ORG);
    await selectOrgInPicker(page, devHubAlias);
    // Picker writes config directly (no success toast); the status bar is the signal.
    await expectOrgPickerStatusBar(page, devHubAlias);
  });

  await test.step('cancel at the scratch-def picker via Escape', async () => {
    await clickOrgPickerStatusBar(page, devHubAlias);
    await selectQuickInputOptionByTyping(page, packageNls.org_create_default_scratch_org_text);
    // Wait for the def-file quickpick to render its first row, then dismiss it.
    await waitForQuickInputFirstOption(page);
    await page.keyboard.press('Escape');
  });

  // Positive deterministic signal: the status bar still shows the dev hub. A created+set-default org
  // would have flipped it to a new scratch alias, so an unchanged dev-hub status bar proves the cancel
  // produced no org. (Asserting non-appearance of a toast/channel line would require a flaky
  // timeout-based negative expect — avoided per plan.)
  await test.step('cancel is silent: status bar still shows the dev hub', async () => {
    await expectOrgPickerStatusBar(page, devHubAlias);
  });
});
