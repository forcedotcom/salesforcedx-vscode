/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Locator } from '@playwright/test';

/**
 * DOM-focus the keystroke target: `div.native-edit-context` when `editor.editContext` is on, else `textarea.inputarea`.
 * View-lines cover it, so pointer focus misses.
 */
export const focusMonacoInput = async (editor: Locator): Promise<void> => {
  const input = editor.locator('.native-edit-context, textarea.inputarea');
  await input.evaluate(el => {
    el.focus();
  });
  await expect(input).toBeFocused();
};
