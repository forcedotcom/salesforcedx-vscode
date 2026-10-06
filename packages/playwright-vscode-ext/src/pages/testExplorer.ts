/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import { focusMonacoInput } from '../utils/focusMonacoInput';
import { EDITOR } from '../utils/locators';
import { verifyCommandDoesNotExist } from './commands';

/** The Testing view container. */
export const TEST_EXPLORER_PANEL = '[id="workbench.view.extension.test"]';

/** A row in the Test Explorer tree. */
export const TEST_EXPLORER_TREE_ITEM = '[role="treeitem"]';

/**
 * Types `text` into the Test Explorer filter box, replacing whatever is there.
 *
 * The filter is a Monaco editor (`data-uri="testing:filter"`) when that editor is present;
 * otherwise a plain input. Focusing the `.monaco-editor` wrapper does not move DOM focus to
 * the Monaco input, so keystrokes land in whichever editor was already focused (often the
 * Output panel) and the filter stays empty. Focus it, then drive keys via `page.keyboard`.
 * On macOS Ctrl+A is bound to "cursor home" in Monaco, not select-all, so clear with
 * Home → Shift+End → Delete.
 *
 * Pass an empty string to clear the filter (or use {@link clearFilter}).
 */
export const focusAndTypeInFilter = async (page: Page, text: string): Promise<void> => {
  const monacoFilter = page.locator(`${EDITOR}[data-uri="testing:filter"]`);
  const inputFilter = page.locator('input[placeholder*="Filter"][placeholder*="@tag"]');
  if (await monacoFilter.isVisible().catch(() => false)) {
    await focusMonacoInput(monacoFilter);
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');
    await page.keyboard.press('Delete');
    if (text) {
      await page.keyboard.type(text);
      await expect(monacoFilter.locator('.view-lines')).toContainText(text);
    }
  } else {
    await inputFilter.waitFor({ state: 'visible', timeout: 10_000 });
    await inputFilter.fill(text);
  }
};

/** Clears the Test Explorer filter box and dismisses the filter UI. */
export const clearFilter = async (page: Page): Promise<void> => {
  await focusAndTypeInFilter(page, '');
  await page.keyboard.press('Escape');
};

// VS Code lists this only while a test run is in progress (`testing.isRunning` context key).
const CMD_CANCEL_TEST_RUN = 'Test: Cancel Test Run';

/**
 * Asserts every test run has ended (Test Explorer / Test Results spinners stopped). Results, tree
 * decorations, and the `Ended …` channel sentinel can all land while the TestRun is still open, so
 * they don't prove this. Don't click or dismiss the success toast first: that would end a run that
 * was blocked on it and mask the regression.
 */
export const verifyNoTestRunInProgress = async (page: Page, timeout?: number): Promise<void> =>
  verifyCommandDoesNotExist(page, CMD_CANCEL_TEST_RUN, timeout);
