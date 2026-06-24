/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  activeQuickInputWidget,
  closeWelcomeTabs,
  createMinimalOrg,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  expectOrgPickerListsOrg,
  MINIMAL_ORG_ALIAS,
  NOTIFICATION_LIST_ITEM,
  QUICK_INPUT_LIST_ROW,
  QUICK_INPUT_WIDGET,
  selectOrgInPicker,
  selectOutputChannel,
  upsertScratchOrgAuthFieldsToSettings,
  verifyCommandExists,
  waitForOutputChannelText,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { orgDesktopMinimalDefaultTest as test } from '../fixtures/desktopFixtures';

// `channel_name` from salesforcedx-vscode-org/src/messages/i18n.ts (orgDisplay writes its table here).
const ORG_OUTPUT_CHANNEL = 'Salesforce Org Management';

// Exercises the three migrated org pickers (Effect + PromptService.considerUndefinedAsCancellation):
//   - selectOrgForDisplay (single-pick)  -> sf.org.display.username
//   - selectDeletableOrg (multi-pick + confirm) -> sf.org.delete.username
//   - selectOrgsForLogout (multi-pick + confirm) -> sf.org.logout.all
// plus the cancel mappings: Esc (UserCancellationError -> CANCEL) and multi-pick "pick nothing" ([] -> CANCEL).
// The fixture sets a SCRATCH org (MINIMAL_ORG_ALIAS) as default, satisfying sf:project_opened +
// sf:has_target_org + sf:default_org_deletable. We cancel at every confirm modal so the fixture org
// is never actually deleted or logged out.
test('org pickers: display, delete, logout pick + confirm + cancel flows', async ({ page }) => {
  test.setTimeout(180_000);

  await test.step('setup scratch default org', async () => {
    const createResult = await createMinimalOrg();
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
  });

  // Gate on an always-present activation command so we don't false-negative on slow startup.
  await test.step('verify extension is activated', async () => {
    await verifyCommandExists(page, packageNls.org_login_web_authorize_org_text, 60_000);
  });

  await test.step('DISPLAY: selectOrgForDisplay lists the org, pick it, assert output table', async () => {
    await executeCommandWithCommandPalette(page, packageNls.org_display_username_text);
    // selectOrgForDisplay (single-pick) lists the seeded scratch org.
    await expectOrgPickerListsOrg(page, MINIMAL_ORG_ALIAS);
    await selectOrgInPicker(page, MINIMAL_ORG_ALIAS);
    // orgDisplay renders a table containing the org's Username row to the output channel.
    await selectOutputChannel(page, ORG_OUTPUT_CHANNEL);
    await waitForOutputChannelText(page, { expectedText: 'Username' });
  });

  await test.step('DISPLAY cancel: Esc on the picker maps to CANCEL (no error toast)', async () => {
    await executeCommandWithCommandPalette(page, packageNls.org_display_username_text);
    await expectOrgPickerListsOrg(page, MINIMAL_ORG_ALIAS);
    await page.keyboard.press('Escape');
    await expect(page.locator(QUICK_INPUT_WIDGET)).toBeHidden({ timeout: 10_000 });
    await expectNoErrorNotification(page);
  });

  await test.step('DELETE: selectDeletableOrg multi-pick lists the scratch org, then cancel confirm', async () => {
    // sf.org.delete.username routes to the SelectDeletableOrg picker (index.ts -> orgDelete -> new SelectDeletableOrg()).
    await executeCommandWithCommandPalette(page, packageNls.org_delete_username_text);
    await expectOrgPickerListsOrg(page, MINIMAL_ORG_ALIAS);
    // Toggle the scratch org row (canPickMany), then accept to reach the confirm modal.
    await toggleMultiPickRow(page, MINIMAL_ORG_ALIAS);
    await page.keyboard.press('Enter');
    // Cancel the confirm modal so the fixture org is NOT deleted; this maps to CANCEL.
    await page.keyboard.press('Escape');
    await expectNoErrorNotification(page);
  });

  await test.step('DELETE cancel: multi-pick pick-nothing + Enter ([] empty-array) maps to CANCEL', async () => {
    await executeCommandWithCommandPalette(page, packageNls.org_delete_username_text);
    await expectOrgPickerListsOrg(page, MINIMAL_ORG_ALIAS);
    // Accept with nothing selected -> [] -> Phase 2 empty-array guard -> CANCEL (no confirm modal).
    await page.keyboard.press('Enter');
    await expect(page.locator(QUICK_INPUT_WIDGET)).toBeHidden({ timeout: 10_000 });
    await expectNoErrorNotification(page);
  });

  await test.step('LOGOUT: selectOrgsForLogout multi-pick lists the org, then cancel confirm', async () => {
    // sf.org.logout.all routes to the SelectOrgsForLogout picker (index.ts -> orgLogoutAll -> new SelectOrgsForLogout()).
    await executeCommandWithCommandPalette(page, packageNls.org_logout_all_text);
    await expectOrgPickerListsOrg(page, MINIMAL_ORG_ALIAS);
    await toggleMultiPickRow(page, MINIMAL_ORG_ALIAS);
    await page.keyboard.press('Enter');
    // Cancel the confirm modal so the fixture org is NOT logged out; this maps to CANCEL.
    await page.keyboard.press('Escape');
    await expectNoErrorNotification(page);
  });

  await test.step('LOGOUT cancel: Esc on the picker maps to CANCEL', async () => {
    await executeCommandWithCommandPalette(page, packageNls.org_logout_all_text);
    await expectOrgPickerListsOrg(page, MINIMAL_ORG_ALIAS);
    await page.keyboard.press('Escape');
    await expect(page.locator(QUICK_INPUT_WIDGET)).toBeHidden({ timeout: 10_000 });
    await expectNoErrorNotification(page);
  });
});

/** Toggle a `canPickMany` quick-pick row's checkbox by typing the alias and clicking the matching org row. */
const toggleMultiPickRow = async (page: import('@playwright/test').Page, alias: string): Promise<void> => {
  await page.keyboard.type(alias);
  const row = activeQuickInputWidget(page)
    .locator(QUICK_INPUT_LIST_ROW)
    .filter({ hasText: alias })
    .filter({ hasNotText: 'SFDX:' })
    .first();
  await row.waitFor({ state: 'visible', timeout: 10_000 });
  await row.click({ force: true });
};

/** Assert no error toast surfaced (UserCancellationError must map to CANCEL, never an error notification). */
const expectNoErrorNotification = async (page: import('@playwright/test').Page): Promise<void> => {
  await expect(
    page.locator(NOTIFICATION_LIST_ITEM).filter({ has: page.locator('.codicon-error') }),
    'a CANCEL flow must not surface an error notification'
  ).toHaveCount(0);
};
