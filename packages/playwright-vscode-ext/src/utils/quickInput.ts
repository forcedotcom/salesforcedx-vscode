/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Page } from '@playwright/test';
import { QUICK_INPUT_WIDGET } from './locators';

/**
 * Active quick input (command palette, quick pick, quick open). VS Code may retain prior instances in the DOM;
 * the interactive layer is the last matching widget.
 *
 * From VS Code 1.116 onward the widget and `input.input` often fail `toBeVisible()` while still interactive.
 * Prefer `waitFor({ state: 'attached' })` and `click`/`fill` with `{ force: true }`.
 */
export const activeQuickInputWidget = (page: Page) => page.locator(QUICK_INPUT_WIDGET).last();

/** Text field of the active quick input. */
export const activeQuickInputTextField = (page: Page) => activeQuickInputWidget(page).locator('input.input');
