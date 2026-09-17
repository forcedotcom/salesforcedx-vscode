/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Locator, type Page } from '@playwright/test';
import { escapeRegExp } from '../utils/helpers';
import { EDITOR_WITH_URI, WORKBENCH } from '../utils/locators';
import { executeCommandWithCommandPalette } from './commands';

/**
 * Activate an already-open editor tab by file name and wait for its editor to render.
 *
 * Prefer this over Quick Open (`openFileByName`) for a file created earlier in the same test: on the
 * browser-served (code-server) workbench Quick Open intermittently returns the match grouped under a
 * "recently opened" / "other commands" header, and the reconstructed row resolves but is not
 * clickable — a flaky `locator.click: Element is not visible`. Clicking the stable editor tab is
 * reliable. The debug specs create their `.cls`/`.apex` files (which leaves them open in a tab)
 * before driving a launch, so the tab is always present.
 */
export const activateEditorTab = async (page: Page, fileName: string, timeout = 15_000): Promise<void> => {
  const tab = page.getByRole('tab', { name: new RegExp(escapeRegExp(fileName)) }).first();
  await tab.waitFor({ state: 'visible', timeout });
  await tab.click({ force: true });
  await page
    .locator(`${EDITOR_WITH_URI}[data-uri$="${fileName}"]`)
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
};

/** The floating debug toolbar (Continue / Step / Stop). Present whenever a DAP session is live. */
export const DEBUG_TOOLBAR = '.debug-toolbar';

/** The Run and Debug CALL STACK tree. */
export const DEBUG_CALL_STACK = `${WORKBENCH} .debug-call-stack`;

/** The Run and Debug VARIABLES tree. */
export const DEBUG_VARIABLES = `${WORKBENCH} .debug-variables`;

/** Assert the debug toolbar is visible (i.e. a debug session is live). */
export const assertDebugToolbarVisible = async (page: Page, timeout = 60_000): Promise<void> => {
  await expect(page.locator(DEBUG_TOOLBAR)).toBeVisible({ timeout });
};

/** Show the Run and Debug viewlet. Launching replay does not open it automatically. */
export const showRunAndDebugView = async (page: Page): Promise<void> => {
  await executeCommandWithCommandPalette(page, 'View: Show Run and Debug');
};

/** All rows of the CALL STACK tree. Show the Run and Debug view first via {@link showRunAndDebugView}. */
export const getCallStackRows = (page: Page): Locator => page.locator(`${DEBUG_CALL_STACK} .monaco-list-row`);

/**
 * Show the Run and Debug view, focus the VARIABLES view, and return its locator once visible.
 * Launching a replay session does not open the viewlet, so show it before focusing VARIABLES.
 */
export const openVariablesView = async (page: Page, timeout = 30_000): Promise<Locator> => {
  await showRunAndDebugView(page);
  await executeCommandWithCommandPalette(page, 'Run and Debug: Focus on Variables View');
  const variablesView = page.locator(DEBUG_VARIABLES);
  await variablesView.waitFor({ state: 'visible', timeout });
  return variablesView;
};

/**
 * Expand every collapsed scope row (Local/Static/Global) in the VARIABLES tree so locals render.
 * Clicks each top-level (aria-level="1") scope's twistie once, tracked by aria-label. An empty scope
 * (e.g. Global with no variables) never leaves the collapsed state, so we must NOT drive the
 * collapsed set to zero (that would spin until timeout on the empty scope) — instead attempt each
 * scope exactly once. Clicking a twistie mutates the live list, so re-query after each click.
 */
export const expandAllVariableScopes = async (variablesView: Locator, timeout = 30_000): Promise<void> => {
  const deadline = Date.now() + timeout;
  const attempted = new Set<string>();
  while (Date.now() < deadline) {
    const collapsed = variablesView.locator('.monaco-list-row[aria-level="1"][aria-expanded="false"]');
    const count = await collapsed.count();
    let clickedOne = false;
    for (let i = 0; i < count; i++) {
      const row = collapsed.nth(i);
      const label = (await row.getAttribute('aria-label').catch(() => null)) ?? `row-${i}`;
      if (attempted.has(label)) {
        continue;
      }
      attempted.add(label);
      await row
        .locator('.monaco-tl-twistie')
        .click({ force: true })
        .catch(() => {});
      clickedOne = true;
      break; // list mutated by the expand; re-query from the top
    }
    if (!clickedOne) {
      break; // every collapsed scope has been attempted once
    }
  }
};

/**
 * Locate a VARIABLES row by its variable-name cell (exact match on the highlighted-label text).
 * Expand its parent scopes first via {@link expandAllVariableScopes}.
 */
export const getVariableRow = (variablesView: Locator, page: Page, name: string): Locator =>
  variablesView
    .locator('.monaco-list-row')
    .filter({ has: page.locator('.monaco-highlighted-label', { hasText: new RegExp(`^${name}$`) }) })
    .first();

/**
 * Expand a nested variable's twistie and wait for one of its child property rows to render.
 * Selects the row then presses ArrowRight: on a Monaco tree Right expands a collapsed row (never
 * collapses an expanded one), so it's idempotent under CI timing where the row may already be
 * expanded. Re-drives until a matching child appears.
 */
export const expandNestedVariable = async (
  page: Page,
  variablesView: Locator,
  parentRow: Locator,
  childMatcher: RegExp,
  timeout = 30_000
): Promise<Locator> => {
  const childRow = variablesView.locator('.monaco-list-row').filter({ hasText: childMatcher }).first();
  await expect(async () => {
    await parentRow.click({ force: true });
    await page.keyboard.press('ArrowRight');
    await expect(childRow).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout });
  return childRow;
};

/** Continue debug session (dismiss hover, Escape, then F5). Repeats until session ends. */
export const continueDebugSession = async (page: Page, maxContinues = 2): Promise<void> => {
  const toolbar = page.locator(DEBUG_TOOLBAR);
  for (let i = 0; i < maxContinues; i++) {
    await toolbar.waitFor({ state: 'visible', timeout: 15_000 });
    // Click editor area to dismiss search-bar hover that can cover debug toolbar and block F5
    await page.locator(`${WORKBENCH} .editor-instance .view-lines`).first().click({ force: true });
    await page.keyboard.press('Escape');
    await page.keyboard.press('F5');
    // Catch intentionally swallows rejection to detect debug session end (pre-existing pattern)
    const sessionEnded = await expect(toolbar)
      .not.toBeVisible({ timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    if (sessionEnded) break;
  }
  await expect(toolbar).not.toBeVisible({ timeout: 45_000 });
};

/**
 * Guaranteed debug-session teardown for a shared, persistent workbench: a session left running
 * would poison the next test. If the toolbar is still up (a mid-test failure never reached the
 * clean stop), stop the session and wait for it to disappear. Best-effort — never throws, so it's
 * safe to call unconditionally from `afterEach`.
 */
export const stopDebugSession = async (page: Page, timeout = 30_000): Promise<void> => {
  const toolbar = page.locator(DEBUG_TOOLBAR);
  if (await toolbar.isVisible().catch(() => false)) {
    await executeCommandWithCommandPalette(page, 'Debug: Stop').catch(() => {});
    await expect(toolbar)
      .not.toBeVisible({ timeout })
      .catch(() => {});
  }
};
