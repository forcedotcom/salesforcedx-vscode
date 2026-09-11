/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Locator, type Page } from '@playwright/test';
import { waitForQuickInputFirstOption } from '../utils/helpers';
import { QUICK_INPUT_LIST_ROW, QUICK_INPUT_WIDGET, STATUS_BAR_ITEM_LABEL } from '../utils/locators';
import { activeQuickInputWidget } from '../utils/quickInput';

/**
 * Locate the org-picker / default-org status bar item by its rendered label text. The org-picker item
 * has no stable DOM id, so we find it by the visible label (`STATUS_BAR_ITEM_LABEL` + `hasText`).
 * `currentText` is the label the item currently shows ("No Default Org Set" before an org is set,
 * then the org alias).
 * `.first()`: only the org-picker item shows a user alias; other Salesforce status-bar items render
 * fixed icons/text that cannot contain the alias, so the first label match is the org-picker item.
 */
const orgPickerStatusBarItem = (page: Page, currentText: string | RegExp): Locator =>
  page.locator(STATUS_BAR_ITEM_LABEL).filter({ hasText: currentText }).first();

/**
 * Click the org-picker / default-org status bar item (opens the org quick pick). Pass the label the
 * item currently shows so the right item is located (the label changes from no-org → alias).
 */
export const clickOrgPickerStatusBar = async (
  page: Page,
  currentText: string | RegExp,
  opts?: { timeout?: number }
): Promise<void> => {
  const item = orgPickerStatusBarItem(page, currentText);
  await item.click({ force: true, timeout: opts?.timeout ?? 10_000 });
};

/**
 * Assert the org-picker status bar item shows `expected` (substring or regex). Polls because the
 * `TargetOrgRef` watcher updates the bar asynchronously after a config change.
 */
export const expectOrgPickerStatusBar = async (
  page: Page,
  expected: string | RegExp,
  opts?: { timeout?: number }
): Promise<void> => {
  await expect(
    orgPickerStatusBarItem(page, expected),
    `Org picker status bar should show ${String(expected)}`
  ).toBeVisible({ timeout: opts?.timeout ?? 30_000 });
};

/**
 * Assert the open org picker lists all `actionLabels` SFDX action commands (the 5 `ACTION_ITEMS`).
 * Labels carry an icon prefix, so this matches on substring.
 */
export const expectOrgPickerActionItems = async (
  page: Page,
  actionLabels: readonly string[],
  opts?: { timeout?: number }
): Promise<void> => {
  await waitForQuickInputFirstOption(page);
  const widget = activeQuickInputWidget(page);
  // `hasText` is a substring match, and some action labels are substrings of others
  // (e.g. "SFDX: Authorize an Org" ⊂ "SFDX: Authorize an Org using Session ID"), so a label can
  // match multiple rows. Assert the first matching row is visible to avoid a strict-mode violation.
  await Promise.all(
    actionLabels.map(label =>
      expect(
        widget.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: label }).first(),
        `Org picker should list action item "${label}"`
      ).toBeVisible({ timeout: opts?.timeout ?? 10_000 })
    )
  );
};

/**
 * Select an org row (by alias) in the open org picker, typing to filter first.
 *
 * `selectQuickInputOptionByTyping` matches any row containing the filter text, but a short alias
 * (e.g. CI's dev-hub alias "hub") is also a substring of an action item ("SFDX: Authorize a Dev
 * Hub"). The action items are `${ICON} SFDX: ...`, while org rows never contain "SFDX:", so this
 * helper excludes action rows to land on the org row deterministically rather than relying on
 * VS Code's fuzzy-scoring tie-break.
 */
export const selectOrgInPicker = async (page: Page, alias: string, opts?: { timeout?: number }): Promise<void> => {
  await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'visible', timeout: opts?.timeout ?? 10_000 });
  // The org list loads asynchronously (AuthInfo.listAllAuthorizations). Wait for the picker to
  // populate its first row before typing — typing into an empty picker filters against rows that
  // haven't rendered yet, so the org row can never match the filter and the waitFor below times out.
  await waitForQuickInputFirstOption(page);
  await page.keyboard.type(alias);
  const orgRow = activeQuickInputWidget(page)
    .locator(QUICK_INPUT_LIST_ROW)
    .filter({ hasText: alias })
    .filter({ hasNotText: 'SFDX:' })
    .first();
  await orgRow.waitFor({ state: 'visible', timeout: opts?.timeout ?? 10_000 });
  await orgRow.evaluate(el => {
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    (el as HTMLElement).click();
  });
};

/** Assert the open org picker lists an org row whose text contains `alias` (pre-switch staleness guard). */
export const expectOrgPickerListsOrg = async (
  page: Page,
  alias: string,
  opts?: { timeout?: number }
): Promise<void> => {
  await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'visible', timeout: opts?.timeout ?? 10_000 });
  const widget = activeQuickInputWidget(page);
  await expect(
    widget.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: alias }).first(),
    `Org picker should list org "${alias}"`
  ).toBeVisible({ timeout: opts?.timeout ?? 10_000 });
};

/**
 * Switch the default org through the status-bar picker AND confirm it took, re-driving the whole
 * interaction if the status bar hasn't settled to `expectLabel`.
 *
 * Why this exists (container flake): `clickOrgPickerStatusBar` → `selectOrgInPicker` →
 * `expectOrgPickerStatusBar` composed inline is racy in the loaded Code Builder container. When a
 * picker row click doesn't register (or the `TargetOrgRef` config write / status-bar watcher lags),
 * the default never changes, so a plain `expectOrgPickerStatusBar` just waits for a label that will
 * never appear and times out. A longer timeout alone can't fix that — the switch must be re-driven.
 *
 * Each `toPass` attempt: if the bar already shows `expectLabel`, done; otherwise dismiss any stray
 * picker, re-open it via the label the bar currently shows (`fromLabel`), optionally assert the
 * target org is listed (`assertListsOrg`, the pre-switch staleness guard), select the target
 * (`filterText`, an alias or username), then confirm the bar settled. `toPass` retries the whole
 * block, so a dropped click or a slow watcher refresh no longer fails the switch.
 */
export const switchDefaultOrgViaPicker = async (
  page: Page,
  opts: {
    /** Label the status bar shows BEFORE the switch (used to locate + click the picker on each retry). */
    fromLabel: string | RegExp;
    /** Text typed into the picker to filter to the target org row (its alias, or username if unaliased). */
    filterText: string;
    /** Label the status bar must show AFTER the switch settles (the target org's alias or username). */
    expectLabel: string | RegExp;
    /** Optional pre-select staleness guard: assert the picker lists this org before selecting. */
    assertListsOrg?: string;
    /** Overall budget for the switch to take + the status bar to reflect it (default 60s). */
    timeout?: number;
  }
): Promise<void> => {
  const confirmItem = orgPickerStatusBarItem(page, opts.expectLabel);
  await expect(async () => {
    // Already settled on the target org — the switch took (possibly on a prior attempt).
    if (await confirmItem.isVisible().catch(() => false)) {
      return;
    }
    // Close any picker left open by a dropped click on the previous attempt, then re-drive.
    await page.keyboard.press('Escape').catch(() => {});
    await clickOrgPickerStatusBar(page, opts.fromLabel);
    if (opts.assertListsOrg !== undefined) {
      await expectOrgPickerListsOrg(page, opts.assertListsOrg);
    }
    await selectOrgInPicker(page, opts.filterText);
    await expect(confirmItem, `Org picker status bar should show ${String(opts.expectLabel)}`).toBeVisible({
      timeout: 20_000
    });
  }).toPass({ timeout: opts.timeout ?? 60_000 });
};
