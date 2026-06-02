/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Locator, type Page } from '@playwright/test';
import { EDITOR, executeCommandWithCommandPalette } from '@salesforce/playwright-vscode-ext';
import { messages } from '../../../src/messages/i18n';

export const TEST_EXPLORER_PANEL = '[id="workbench.view.extension.test"]';
export const TEST_EXPLORER_TREE_ITEM = '[role="treeitem"]';
export const TEST_RESULTS_TAB = 'a.action-label[aria-label="Test Results"]';
const LOCAL_NAMESPACE_LABEL = messages.test_explorer_local_namespace_label;
const UNPACKAGED_METADATA_LABEL = messages.test_explorer_unpackaged_metadata_label;

// Built-in VS Code commands triggered via the Command Palette.
const CMD_FOCUS_TEST_EXPLORER = 'Testing: Focus on Test Explorer View';
export const CMD_REFRESH_TESTS = 'Test: Refresh Tests';
export const CMD_RUN_ALL_TESTS = 'Test: Run All Tests';
export const CMD_TOGGLE_MAXIMIZED_PANEL = 'View: Toggle Maximized Panel';

// Test Controller ID matches `TEST_CONTROLLER_ID` in `src/views/testController.ts`.
const APEX_TEST_CONTROLLER_ID = 'sf.apex.testController';
export const STALE_FILTER_TAG = `@${APEX_TEST_CONTROLLER_ID}:stale`;
export const STALE_AUTOCOMPLETE_OPTION = `${APEX_TEST_CONTROLLER_ID}:stale`;

/**
 * Expands a tree row in the Test Explorer. Twistie click (force) needed for compact rows;
 * 400ms settle window matches the working pattern from prior test history (CI runs with
 * this pattern reliably reach the expanded state — see [run](https://github.com/forcedotcom/salesforcedx-vscode/actions/runs/26587894571)).
 */
const expandTreeRow = async (panel: Locator, rowLabel: string): Promise<void> => {
  const row = panel.locator(TEST_EXPLORER_TREE_ITEM).filter({ hasText: rowLabel });
  await row.waitFor({ state: 'visible', timeout: 15_000 });
  const twistie = row.locator('.monaco-tl-twistie');

  const isExpanded = async (): Promise<boolean> => {
    try {
      const collapsed = await twistie.evaluate(el => el.classList.contains('collapsed'));
      return !collapsed;
    } catch {
      return false;
    }
  };

  if (await isExpanded()) {
    return;
  }

  try {
    await twistie.click({ force: true });
    await new Promise(resolve => setTimeout(resolve, 400));
  } catch {
    // continue
  }
};

const expandNamespaceAndPackage = async (panel: Locator): Promise<void> => {
  await expandTreeRow(panel, LOCAL_NAMESPACE_LABEL);
  await panel
    .locator(TEST_EXPLORER_TREE_ITEM)
    .filter({ hasText: UNPACKAGED_METADATA_LABEL })
    .waitFor({ state: 'visible', timeout: 10_000 });
  await expandTreeRow(panel, UNPACKAGED_METADATA_LABEL);
};

export const openTestExplorerAndDiscover = async (page: Page): Promise<Locator> => {
  await executeCommandWithCommandPalette(page, CMD_FOCUS_TEST_EXPLORER);
  const panel = page.locator(TEST_EXPLORER_PANEL);
  await panel.waitFor({ state: 'visible', timeout: 10_000 });
  await executeCommandWithCommandPalette(page, CMD_REFRESH_TESTS);
  // Discovery clears and rebuilds the tree asynchronously. The rebuild starts after
  // `Test: Refresh Tests` returns, so we wait for the top-level node to disappear briefly
  // (or never if the refresh is fast) before asserting it reappears.
  await panel
    .getByText(LOCAL_NAMESPACE_LABEL)
    .first()
    .waitFor({ state: 'hidden', timeout: 2000 })
    .catch(() => {});
  await expect(panel.getByText(LOCAL_NAMESPACE_LABEL)).toBeVisible({ timeout: 60_000 });
  await expandNamespaceAndPackage(panel);
  return panel;
};

/**
 * Runs all tests via the command palette and waits until the Test Results panel
 * shows a pass-rate summary. The Test Results panel shows "Pass Rate" / "Tests Ran"
 * statistics once a run completes; the prior `/passed|Passed/i` text match never
 * matched (only aria-labels carry "(Passed)") and caused the test to hang to timeout.
 */
export const runAllTestsAndWaitForCompletion = async (page: Page, timeout: number): Promise<void> => {
  await executeCommandWithCommandPalette(page, CMD_RUN_ALL_TESTS);
  const testResultsTab = page.locator(TEST_RESULTS_TAB);
  await testResultsTab.waitFor({ state: 'visible', timeout: 30_000 });
  await expect(page.getByText(/Pass Rate/i)).toBeVisible({ timeout });
};

/**
 * Test Explorer tree row by display name. The Test Explorer renders rows as ARIA treeitems
 * whose accessible name embeds the display label, so getByRole('treeitem', { name: ... })
 * matches a class or method node by substring.
 */
export const findTestExplorerItem = (page: Page, name: string): Locator => page.getByRole('treeitem', { name }).first();

/**
 * Hovers a Test Explorer tree row to reveal inline actions, then clicks the named action
 * (e.g. `Run Test`, `Debug Test`). VS Code renders inline actions with the action label as
 * `aria-label`; the underlying ARIA role differs between desktop and web (`link` vs `button`),
 * so we match on aria-label rather than role.
 */
export const clickTreeItemAction = async (treeItem: Locator, actionLabel: string): Promise<void> => {
  await treeItem.hover();
  const action = treeItem.locator(`[aria-label="${actionLabel}"]`).first();
  await action.waitFor({ state: 'visible', timeout: 10_000 });
  await action.click();
};

export const focusAndTypeInFilter = async (page: Page, text: string): Promise<void> => {
  // Desktop uses a Monaco editor (data-uri="testing:filter") backed by a hidden
  // <textarea>; web uses a plain input. The Monaco view-lines layer intercepts
  // pointer events, so click the wrapper (force) and drive keys via page.keyboard
  // (focused on the hidden textarea). On macOS Ctrl+A is bound to "cursor home"
  // in Monaco, not select-all, so use Home → Shift+End → Delete to clear.
  const monacoFilter = page.locator(`${EDITOR}[data-uri="testing:filter"]`);
  const inputFilter = page.locator('input[placeholder*="Filter"][placeholder*="@tag"]');
  if (await monacoFilter.isVisible().catch(() => false)) {
    await monacoFilter.click({ force: true });
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');
    await page.keyboard.press('Delete');
    if (text) await page.keyboard.type(text);
  } else {
    await inputFilter.waitFor({ state: 'visible', timeout: 10_000 });
    await inputFilter.fill(text);
  }
};

export const clearFilter = async (page: Page): Promise<void> => {
  await focusAndTypeInFilter(page, '');
  await page.keyboard.press('Escape');
};
