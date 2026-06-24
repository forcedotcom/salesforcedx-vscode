/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Locator, Page } from '@playwright/test';
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
 * Callers should still `waitFor({ state: 'attached' })` and `click`/`fill` with `{ force: true }`: from VS Code
 * 1.116 onward the widget can briefly fail visibility checks while animating in, and the `attached` wait on this
 * locator retries (re-evaluating `:visible`) until the live widget settles.
 */
export const activeQuickInputWidget = (page: Page): Locator =>
  page.locator(QUICK_INPUT_WIDGET).filter({ visible: true }).last();

/** Text field of the active quick input. */
export const activeQuickInputTextField = (page: Page) => activeQuickInputWidget(page).locator('input.input');
