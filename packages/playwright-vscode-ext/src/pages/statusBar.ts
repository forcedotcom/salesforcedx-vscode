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
 * has no stable DOM id, so — mirroring the WDIO `getStatusBarItemWhichIncludes` aria-label match — we
 * find it by the visible label (`STATUS_BAR_ITEM_LABEL` + `hasText`). `currentText` is the label the
 * item currently shows ("No Default Org Set" before an org is set, then the org alias).
 */
const orgPickerStatusBarItem = (page: Page, currentText: string | RegExp): Locator =>
  page.locator(STATUS_BAR_ITEM_LABEL).filter({ hasText: currentText });

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
 * Assert the open org picker lists all `actionLabels` SFDX action commands (ports WDIO's check of the
 * 5 `ACTION_ITEMS`). Labels carry an icon prefix, so this matches on substring — mirrors the WDIO
 * `aria-label.includes` check.
 */
export const expectOrgPickerActionItems = async (
  page: Page,
  actionLabels: readonly string[],
  opts?: { timeout?: number }
): Promise<void> => {
  await waitForQuickInputFirstOption(page);
  const widget = activeQuickInputWidget(page);
  await Promise.all(
    actionLabels.map(label =>
      expect(
        widget.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: label }),
        `Org picker should list action item "${label}"`
      ).toBeVisible({ timeout: opts?.timeout ?? 10_000 })
    )
  );
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
    widget.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: alias }),
    `Org picker should list org "${alias}"`
  ).toBeVisible({ timeout: opts?.timeout ?? 10_000 });
};
