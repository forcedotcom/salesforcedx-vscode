/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import {
  clickModalDialogButton,
  closeWelcomeTabs,
  createMinimalOrg,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  selectOutputChannel,
  upsertScratchOrgAuthFieldsToSettings,
  verifyCommandExists,
  waitForNotification,
  waitForOutputChannelText,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { orgDesktopMinimalDefaultCustomDialogTest as test } from '../fixtures/desktopFixtures';
import { removeStaleScratchOrgAuth, writeStaleScratchOrgAuth } from '../helpers/staleScratchOrgAuth';

const ORG_OUTPUT_CHANNEL = 'Salesforce Org Management';

// Exercises sf.org.list.clean (orgListCleanCommand). The fixture seeds a non-expired scratch org
// (MINIMAL_ORG_ALIAS) as default, so there is nothing expired/deleted to remove. The command must
// detect that, show an info toast, and NOT prompt for confirmation of a no-op.
test('org list clean: no removable orgs -> info toast, no confirm modal', async ({ page }) => {
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

  await test.step('run command -> "no orgs to remove" info toast, no modal', async () => {
    await executeCommandWithCommandPalette(page, packageNls.org_list_clean_text);
    // Nothing expired/deleted: an info toast appears and the confirm modal must NOT be shown.
    await waitForNotification(page, /No expired or deleted orgs found to remove/);
    await expectNoConfirmModal(page);
  });
});

/** Assert the confirm modal dialog never rendered (the no-op path must skip confirmation). */
const expectNoConfirmModal = async (page: Page): Promise<void> => {
  await expect(
    page.locator('.monaco-dialog-box, .dialog-shadow'),
    'a no-op clean must not prompt for confirmation'
  ).toHaveCount(0);
};

// Exercises the MIGRATED path: seeding a synthetic expired scratch org makes the removal set non-empty,
// so after confirm+remove the command calls displayRemainingOrgs -> processOrgForDisplay ->
// determineConnectedStatusForNonScratchOrg('hub') -> getConnection('hub') + conn.refreshAuth(). The
// live `hub` dev hub (authed globally in orgE2E.yml) is a non-scratch, live org, so its remaining-orgs
// row must show Status 'Connected' — proving the migrated getConnection(username)+refreshAuth probe ran
// live end-to-end. (The minimalTestOrg scratch row hits the 'Active' branch and is NOT proof.)
test('org list clean: removable org -> confirm, remove, remaining-orgs table shows hub Connected', async ({ page }) => {
  test.setTimeout(180_000);

  await test.step('setup scratch default org + synthetic expired org', async () => {
    const createResult = await createMinimalOrg();
    await writeStaleScratchOrgAuth();
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
  });

  // Gate on an always-present activation command so we don't false-negative on slow startup.
  await test.step('verify extension is activated', async () => {
    await verifyCommandExists(page, packageNls.org_login_web_authorize_org_text, 60_000);
  });

  try {
    await test.step('run command -> confirm removal of the expired org', async () => {
      await executeCommandWithCommandPalette(page, packageNls.org_list_clean_text);
      // Non-empty removal set: the confirm modal must appear; click its Remove button.
      await clickModalDialogButton(page, 'Remove');
    });

    await test.step('remaining-orgs table shows hub with Status Connected', async () => {
      await selectOutputChannel(page, ORG_OUTPUT_CHANNEL);
      // The remaining-orgs table renders after removal. The hub row (a live non-scratch org) reaching
      // 'Connected' proves determineConnectedStatusForNonScratchOrg('hub') ran getConnection + refreshAuth live.
      await waitForOutputChannelText(page, { expectedText: 'Connected', timeout: 90_000 });
      await waitForOutputChannelText(page, { expectedText: 'hub', timeout: 5000 });
    });
  } finally {
    // The synthetic org is removed by the command on success, but clean up defensively in case of failure.
    await removeStaleScratchOrgAuth();
  }
});
