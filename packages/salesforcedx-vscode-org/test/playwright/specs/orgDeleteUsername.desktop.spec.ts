/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import {
  activeQuickInputWidget,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  env,
  execAsync,
  executeCommandWithCommandPalette,
  expectOrgPickerListsOrg,
  QUICK_INPUT_LIST_ROW,
  QUICK_INPUT_WIDGET,
  verifyCommandExists,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { orgDeleteUsernameTest as test } from '../fixtures/orgDeleteUsernameFixtures';

// Asserts sf.org.delete.username (migrated to Effect + TerminalService) really deletes the picked org
// AND refreshes the picker list without a window reload (updateConfigAndStateAggregators).
//
// Uses a DEDICATED, dynamically named scratch org — never MINIMAL_ORG_ALIAS. createDesktopConfig runs
// fullyParallel with no workers cap, so a spec that deletes the shared org would yank it out from under
// orgPickers/orgDeleteCommandVisibility running concurrently. The unique alias is referenced by no other
// spec, so deleting it is safe.

// `org_delete_confirm_label` lives in src/messages/i18n.ts (not package.nls.json); the modal confirm button reads 'Delete'.
const DELETE_CONFIRM_LABEL = 'Delete';

test('org delete username: deletes a dedicated scratch org and refreshes the picker list', async ({
  page
}, testInfo) => {
  // Scratch org creation + delete are multi-minute CLI operations. Worst case: create -w 10 (~600s) +
  // waitForOrgGone (120s) + workbench startup + two picker opens + modal. 15 min leaves headroom on slow CI.
  test.setTimeout(900_000);

  const alias = `TempDeleteOrg_${Date.now()}_${testInfo.workerIndex}_${Math.random().toString(36).slice(2)}`;

  try {
    await test.step('create the dedicated scratch org via CLI', async () => {
      await execAsync(`sf org create scratch -d -w 10 -a ${alias} --edition developer --json`, { env });
    });

    await test.step('open workbench, prepare UI', async () => {
      await waitForVSCodeWorkbench(page);
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
    });

    // Gate on an always-present activation command so we don't false-negative on slow startup.
    await test.step('verify extension is activated', async () => {
      await verifyCommandExists(page, packageNls.org_login_web_authorize_org_text, 60_000);
    });

    await test.step('delete the dedicated org via the picker + confirm', async () => {
      await executeCommandWithCommandPalette(page, packageNls.org_delete_username_text);
      // The picker (selectDeletableOrg) lists all deletable orgs from getFreshAuthorizations(); the
      // freshly created scratch org appears without a reload.
      await expectOrgPickerListsOrg(page, alias);
      await toggleMultiPickRow(page, alias);
      await page.keyboard.press('Enter');
      // ACCEPT the confirm modal (this spec asserts a real delete, unlike orgPickers which cancels).
      await clickModalDialogButton(page, DELETE_CONFIRM_LABEL);
    });

    await test.step('delete completes: org auth is gone (CLI check)', async () => {
      // CLI delete completes in seconds on success; 2 min is ample and keeps the worst-case step budget
      // (org create -w 10 = 600s + this) under test.setTimeout.
      await waitForOrgGone(alias, 120_000);
    });

    await test.step('picker list refreshed: reopening the delete picker no longer lists the org', async () => {
      await executeCommandWithCommandPalette(page, packageNls.org_delete_username_text);
      await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'visible', timeout: 30_000 });
      // updateConfigAndStateAggregators flushed the cache + refreshed the list without a window reload,
      // so the deleted org must NOT appear.
      await expect(
        activeQuickInputWidget(page).locator(QUICK_INPUT_LIST_ROW).filter({ hasText: alias }),
        `deleted org "${alias}" must not appear in the refreshed picker`
      ).toHaveCount(0, { timeout: 15_000 });
      await page.keyboard.press('Escape');
    });
  } finally {
    // Best-effort cleanup in case the UI delete did not complete, so a failed run doesn't leak an org.
    // The org auto-expires in ~7 days, but deleting here avoids accumulating leftovers.
    await execAsync(`sf org delete scratch --target-org ${alias} --no-prompt`, { env }).catch((error: unknown) => {
      console.warn(`Cleanup: org ${alias} already deleted or could not be deleted. ${String(error)}`);
    });
  }
});

/** Toggle a `canPickMany` quick-pick row's checkbox by typing the alias and clicking the matching org row. */
const toggleMultiPickRow = async (page: Page, alias: string): Promise<void> => {
  await page.keyboard.type(alias);
  const row = activeQuickInputWidget(page)
    .locator(QUICK_INPUT_LIST_ROW)
    .filter({ hasText: alias })
    .filter({ hasNotText: 'SFDX:' })
    .first();
  await row.waitFor({ state: 'visible', timeout: 10_000 });
  await row.click({ force: true });
};

/** Click a modal-dialog button by its label. `window.dialogStyle: custom` (fixture) renders the modal as
 * DOM (.monaco-dialog-box) so Playwright can click it; native Electron dialogs are inaccessible. */
const clickModalDialogButton = async (page: Page, label: string, timeout = 10_000): Promise<void> => {
  const dialogButton = page
    .locator('.monaco-dialog-box, .dialog-shadow')
    .getByRole('button', { name: label, exact: true })
    .first();
  await expect(dialogButton).toBeVisible({ timeout });
  await dialogButton.click();
};

/** Poll `sf org display` until it fails (org auth removed), confirming the delete actually happened.
 * Exponential backoff (1s, doubling, capped at 10s) so a fast delete is detected quickly without
 * accumulating unnecessary delay on slow runs. */
const waitForOrgGone = async (alias: string, timeoutMs: number): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  let delay = 1000;
  while (Date.now() < deadline) {
    try {
      await execAsync(`sf org display -o ${alias} --json`, { env });
    } catch {
      return; // display failed -> org auth is gone -> delete succeeded
    }
    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, 10_000);
  }
  throw new Error(`Org ${alias} was still resolvable after ${timeoutMs}ms; delete did not complete`);
};
