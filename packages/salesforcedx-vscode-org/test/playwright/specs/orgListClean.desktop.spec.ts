/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import {
  closeWelcomeTabs,
  createMinimalOrg,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  MINIMAL_ORG_ALIAS,
  NOTIFICATION_LIST_ITEM,
  selectOutputChannel,
  upsertScratchOrgAuthFieldsToSettings,
  verifyCommandExists,
  waitForOutputChannelText,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { orgDesktopMinimalDefaultCustomDialogTest as test } from '../fixtures/desktopFixtures';

// `channel_name` from salesforcedx-vscode-org/src/messages/i18n.ts (the remaining-orgs table is written here).
const ORG_OUTPUT_CHANNEL = 'Salesforce Org Management';

// Exercises sf.org.list.clean (orgListCleanCommand): PromptService.confirmOrThrow modal + the
// remove/display path. The fixture seeds a non-expired scratch org (MINIMAL_ORG_ALIAS) as default.
//   - Cancel the confirm modal -> UserCancellationError -> CANCEL (no error toast, org untouched).
//   - Confirm -> remove expired/deleted orgs (none here) -> remaining-orgs table renders the seeded org.
test('org list clean: confirm modal cancel + confirm renders remaining-orgs table', async ({ page }) => {
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

  await test.step('CANCEL: dismiss the confirm modal -> CANCEL, no error toast', async () => {
    await executeCommandWithCommandPalette(page, packageNls.org_list_clean_text);
    // confirmOrThrow renders a modal warning whose confirm button is labeled org_list_clean_text.
    await waitForModalDialog(page, packageNls.org_list_clean_text);
    // Dismiss without confirming -> UserCancellationError -> CANCEL (registerCommandWithLayer swallows it).
    await page.keyboard.press('Escape');
    await expect(page.locator('.monaco-dialog-box, .dialog-shadow')).toBeHidden({ timeout: 10_000 });
    await expectNoErrorNotification(page);
  });

  await test.step('CONFIRM: accept the modal -> remaining-orgs table lists the seeded org', async () => {
    await executeCommandWithCommandPalette(page, packageNls.org_list_clean_text);
    await clickModalDialogButton(page, packageNls.org_list_clean_text);
    // displayRemainingOrgs writes a table with a `Username` header. The seeded non-expired scratch org
    // is NOT expired/deleted, so it survives the clean and appears in the table.
    await selectOutputChannel(page, ORG_OUTPUT_CHANNEL);
    await waitForOutputChannelText(page, { expectedText: 'Username' });
    await waitForOutputChannelText(page, { expectedText: MINIMAL_ORG_ALIAS });
  });
});

/** Wait for the custom (DOM) modal dialog carrying `label` to be visible. */
const waitForModalDialog = async (page: Page, label: string): Promise<void> => {
  await expect(
    page.locator('.monaco-dialog-box, .dialog-shadow').getByRole('button', { name: label, exact: true }).first()
  ).toBeVisible({ timeout: 30_000 });
};

/** Click a modal-dialog button by its exact label. Requires `window.dialogStyle: custom` (DOM dialogs). */
const clickModalDialogButton = async (page: Page, label: string): Promise<void> => {
  const button = page
    .locator('.monaco-dialog-box, .dialog-shadow')
    .getByRole('button', { name: label, exact: true })
    .first();
  await expect(button).toBeVisible({ timeout: 30_000 });
  await button.click();
};

/** Assert no error toast surfaced (UserCancellationError must map to CANCEL, never an error notification). */
const expectNoErrorNotification = async (page: Page): Promise<void> => {
  await expect(
    page.locator(NOTIFICATION_LIST_ITEM).filter({ has: page.locator('.codicon-error') }),
    'a CANCEL flow must not surface an error notification'
  ).toHaveCount(0);
};
