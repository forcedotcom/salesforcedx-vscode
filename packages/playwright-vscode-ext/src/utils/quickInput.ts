/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Locator, type Page } from '@playwright/test';
import { QUICK_INPUT_WIDGET } from './locators';

/**
 * Active quick input (command palette, quick pick, quick open).
 *
 * VS Code does not remove a quick input from the DOM when it closes; it hides the widget via `display: none`
 * (notably on Windows, where dismissed `.quick-input-widget` nodes linger). A flow that opens several quick inputs
 * in sequence (e.g. create → rename → rename) therefore leaves multiple widgets attached, and selecting purely by
 * DOM order (`.last()`) can resolve to a stale, hidden one — so a `fill()` lands in a dead widget while the live
 * input keeps its value. Filter to visible widgets first so dismissed (`display: none`) ones are excluded; `.last()`
 * then disambiguates if more than one is genuinely open.
 *
 * `locator.fill()` and `locator.click()` already wait for visibility, and `fill()` also waits until the field is
 * editable. `waitForActiveQuickInputTextField` is for `page.keyboard.type` and `locator.press()`, which do not.
 * The `:visible` filter re-evaluates until the live widget settles after its opening animation.
 */
export const activeQuickInputWidget = (page: Page): Locator =>
  page.locator(QUICK_INPUT_WIDGET).filter({ visible: true }).last();

/** Text field of the active quick input. */
export const activeQuickInputTextField = (page: Page) => activeQuickInputWidget(page).locator('input.input');

/**
 * Wait until the active quick input can take keyboard input.
 * `fill()` and `click()` already perform this wait.
 */
export const waitForActiveQuickInputTextField = async (page: Page, timeout = 5000): Promise<Locator> => {
  const input = activeQuickInputTextField(page);
  await expect(input).toBeVisible({ timeout });
  await expect(input).toBeEditable({ timeout });
  return input;
};
