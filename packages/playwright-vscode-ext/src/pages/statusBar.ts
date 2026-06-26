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
 * `currentText` is the label the
 * item currently shows ("No Default Org Set" before an org is set, then the org alias).
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
