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
  selectOutputChannel,
  selectQuickInputOptionByTyping,
  waitForNotification,
  waitForOutputChannelText,
  waitForQuickInputFirstOption,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { orgDesktopTest as test } from '../fixtures/desktopFixtures';

// Migrated 1:1 from WDIO `salesforcedx-vscode-automation-tests/test/specs/authentication.e2e.ts`.
// Tests the org-picker status bar item: no-org state, picker action items, set default org (dev hub),
// create a default scratch org, and switching the default org between dev hub and scratch.

// `missing_default_org` from `salesforcedx-vscode-org/src/messages/i18n.ts` (not in package.nls.json).
const NO_DEFAULT_ORG = 'No Default Org Set';
// `channel_name` from `salesforcedx-vscode-org/src/messages/i18n.ts`.
const ORG_OUTPUT_CHANNEL = 'Salesforce Org Management';
// `%s successfully ran` (`salesforcedx-utils-vscode/src/messages/i18n.ts`), %s = command description.
const SET_DEFAULT_ORG_RAN = /SFDX: Set a Default Org successfully ran/;
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

  // WDIO it #1: initial state shows "No Default Org Set". Dev hub is already globally auth'd in CI
  // (orgE2E.yml --set-default-dev-hub); read its alias rather than re-authorizing via UI.
  const devHubAlias = await getTargetDevHub();
  await test.step('status bar shows No Default Org Set', async () => {
    await expectOrgPickerStatusBar(page, NO_DEFAULT_ORG);
  });

  // WDIO it #2: open the picker via the status bar, verify the 5 action items, select the dev hub.
  // WDIO waits for the `SFDX: Set a Default Org successfully ran` toast, then also asserts the
  // deterministic signals (output-channel config table + status bar). Port both: wait for the toast
  // (with a generous timeout since it auto-collapses) and then the persistent signals below.
  await test.step('set dev hub as default org via picker', async () => {
    await clickOrgPickerStatusBar(page, NO_DEFAULT_ORG);
    await expectOrgPickerActionItems(page, PICKER_ACTION_ITEMS);
    await selectOrgInPicker(page, devHubAlias);
    await waitForNotification(page, SET_DEFAULT_ORG_RAN);
  });

  // WDIO it #2 (output assertion): sf config was actually written, not just the status bar updated.
  // configSet.ts renders a `createTable` whose cells are padded to each column's max width and joined
  // with two spaces, e.g. `target-org  hub    true`. Build the expected row with that same padding so
  // the substring match is exact regardless of the alias length (output search is substring, not regex).
  await test.step('output channel reports target-org set to dev hub', async () => {
    const nameCell = 'target-org'.padEnd(Math.max('Name'.length, 'target-org'.length));
    const valueCell = devHubAlias.padEnd(Math.max('Value'.length, devHubAlias.length));
    const expectedRow = `${nameCell}  ${valueCell}  true`;
    await selectOutputChannel(page, ORG_OUTPUT_CHANNEL);
    await waitForOutputChannelText(page, { expectedText: expectedRow });
  });

  await test.step('status bar shows dev hub alias', async () => {
    await expectOrgPickerStatusBar(page, devHubAlias);
  });

  // WDIO it #3: create a default scratch org via the picker's 3 prompts (def file, alias, days).
  // Alias is dynamic and captured for reuse, mirroring WDIO's `scratchOrgAliasName`. Include the
  // worker index + a random suffix so parallel workers can never collide on the same timestamp.
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
    // Prompt 2: alias input box. Wait for the prior picker text to clear before typing the alias.
    const input = activeQuickInputTextField(page);
    await expect(input, 'alias input box should be empty after the file picker commits').toHaveValue('', {
      timeout: 30_000
    });
    await page.keyboard.type(scratchAlias);
    await page.keyboard.press('Enter');
    // Prompt 3: expiration days input box.
    await expect(input, 'expiration-days input box should be empty after the alias commits').toHaveValue('', {
      timeout: 30_000
    });
    await page.keyboard.type('1');
    await page.keyboard.press('Enter');
  });

  // `--set-default` makes the new org the default. WDIO waits for the create command's success
  // notification (multi-minute command); port that, then assert the persistent status-bar signal.
  await test.step('scratch org create completes and is auto-set as default', async () => {
    await waitForNotification(page, CREATE_SCRATCH_ORG_RAN, { timeout: 600_000 });
    // The success notification signals the command finished; the status bar updates within seconds, so
    // a short timeout here keeps the two sequential waits from summing past the 720s test budget.
    await expectOrgPickerStatusBar(page, scratchAlias, { timeout: 30_000 });
  });

  // WDIO it #4: switch default org back and forth. No window reload — `setDefaultOrg` re-reads auth
  // state from disk on every picker open (orgList.ts AuthInfo.listAllAuthorizations + disk aliases).
  await test.step('switch default org back to dev hub', async () => {
    await clickOrgPickerStatusBar(page, scratchAlias);
    // Staleness guard: confirm the freshly created scratch org appears without a reload.
    await expectOrgPickerListsOrg(page, scratchAlias);
    await selectOrgInPicker(page, devHubAlias);
    await waitForNotification(page, SET_DEFAULT_ORG_RAN);
    await expectOrgPickerStatusBar(page, devHubAlias);
  });

  await test.step('switch default org back to scratch org', async () => {
    await clickOrgPickerStatusBar(page, devHubAlias);
    await selectOrgInPicker(page, scratchAlias);
    await waitForNotification(page, SET_DEFAULT_ORG_RAN);
    await expectOrgPickerStatusBar(page, scratchAlias);
  });

  // Clean up the scratch org created above (WDIO did this via testSetup.tearDown()). Best-effort:
  // the org auto-expires in 1 day and a nightly cron sweeps leftovers, but deleting here avoids
  // leaking a real org on every run. Guarded so a delete failure doesn't fail a passing test.
  await test.step('delete the created scratch org', async () => {
    await execAsync(`sf org delete scratch --target-org ${scratchAlias} --no-prompt`, { env }).catch(
      (error: unknown) => {
        console.warn(`Failed to delete scratch org ${scratchAlias}; it will expire in 1 day. ${String(error)}`);
      }
    );
  });
});
