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
  upsertScratchOrgAuthFieldsToSettings,
  verifyCommandExists,
  waitForNotification,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { orgDesktopMinimalDefaultCustomDialogTest as test } from '../fixtures/desktopFixtures';

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
