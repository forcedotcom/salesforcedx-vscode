/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for getting a SOQL query plan. The web twin (soql-query-plan.spec.ts)
 * proves the flow against a plain Page; this proves a query plan is actually retrieved against the org
 * from inside the Code Builder image, using the container's boot-authed org. Queries a standard object
 * (`Account` exists on every org) so it needs no deploy. Creates the `.soql` via the extension's own
 * "Create SOQL Query" command (opens a text editor — opening a committed `.soql` would launch the SOQL
 * Builder webview instead), so nothing is committed to the shared fixture. Get Query Plan never prompts
 * for an API type (always REST), so there is no API-picker quick input. Results are asserted from the
 * SOQL output channel; no network interception (the Node host makes the HTTP call invisible to Playwright).
 */

import { expect } from '@playwright/test';
import {
  clearAllNotifications,
  clearOutputChannel,
  closeAllEditors,
  EDITOR,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  QUICK_INPUT_WIDGET,
  saveFile,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText,
  waitForQuickInputFirstOption
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

// "Query plan retrieved successfully" comes from i18n key query_plan_complete.
const PLAN_COMPLETE_TEXT = 'Query plan retrieved successfully';
const SOQL_CHANNEL = 'SOQL';
// Unique per run so the shared, persistent workbench never collides across specs or retries.
const SOQL_FILE = `CbSoqlPlan${Date.now()}`;
const SOQL_QUERY = 'SELECT Id, Name FROM Account LIMIT 10';
// executeQueryPlan calls the channel's show() in its finally block — the Output panel opens on its own.
const OUTPUT_PANEL = '[id="workbench.panel.output"]';

// Shared persistent workbench: reset editors + notifications so each spec starts from a known state.
test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('SOQL Query Plan (Code Builder): code lens, current file, selected text via command palette', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await ensureSecondarySideBarHidden(page);
    await verifyCommandExists(page, packageNls.soql_open_new_text_editor, 120_000);
  });

  await test.step('create a .soql file and enter a query', async () => {
    // "Create SOQL Query" prompts for a filename, then an output directory (accept the default).
    await executeCommandWithCommandPalette(page, packageNls.soql_open_new_text_editor);
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
    await page.keyboard.type(SOQL_FILE);
    await page.keyboard.press('Enter');
    await waitForQuickInputFirstOption(page, { quickInputVisibleTimeout: 10_000, optionVisibleTimeout: 10_000 });
    await page.keyboard.press('Enter');

    const soqlTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
    await expect(soqlTab, `${SOQL_FILE}.soql tab should be visible`).toBeVisible({ timeout: 20_000 });

    await page.locator(EDITOR).first().click();
    await page.keyboard.type(SOQL_QUERY);
    await saveFile(page);
    await saveScreenshot(page, 'soqlQueryPlan.container.01-query-saved.png');
  });

  await test.step('get query plan via "Get Query Plan" code lens', async () => {
    const planLens = page.getByRole('button', { name: 'Get Query Plan' });
    await expect(planLens, '"Get Query Plan" code lens should be visible').toBeVisible({ timeout: 15_000 });
    await planLens.click();

    // Get Query Plan always uses REST API — no API-picker quick input is shown.
    // executeQueryPlan calls the channel's show() in finally — wait for the panel to open naturally.
    await page.locator(OUTPUT_PANEL).waitFor({ state: 'visible', timeout: 30_000 });
    await selectOutputChannel(page, SOQL_CHANNEL);
    await waitForOutputChannelText(page, { expectedText: PLAN_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'soqlQueryPlan.container.02-code-lens-plan.png');
  });

  await test.step('get query plan with current file via command palette', async () => {
    const soqlTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
    await soqlTab.click();

    await selectOutputChannel(page, SOQL_CHANNEL);
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, packageNls.query_plan_document_text);

    // Get Query Plan does not prompt for API type.
    await waitForOutputChannelText(page, { expectedText: PLAN_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'soqlQueryPlan.container.03-current-file-plan.png');
  });

  await test.step('get query plan with currently selected text via command palette', async () => {
    const soqlTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
    await soqlTab.click();

    await selectOutputChannel(page, SOQL_CHANNEL);
    await clearOutputChannel(page);

    // Select the whole line via triple-click. This single gesture both focuses Monaco and creates a
    // real editor selection (setting `editorHasSelection` true). `click + Ctrl/Cmd+A` is unreliable
    // in the browser-client host because the synthetic click on `.view-line` doesn't always forward
    // focus to Monaco's hidden input textarea, so the shortcut lands on the browser instead.
    const soqlEditor = page.locator(`${EDITOR}[data-uri$="${SOQL_FILE}.soql"]`);
    await soqlEditor.locator('.view-line').first().click({ clickCount: 3 });
    // Sanity check: the status bar shows "(N selected)" only when the active editor has a real,
    // non-empty selection. If this never appears, the triple-click didn't reach Monaco and the palette
    // command would be hidden by `editorHasSelection`.
    await expect(
      page
        .locator('.statusbar-item')
        .filter({ hasText: /\(\d+ selected\)/ })
        .first()
    ).toBeVisible({ timeout: 5000 });
    await saveScreenshot(page, 'soqlQueryPlan.container.04-text-selected.png');

    // Pass preserveSelection so the shared helper skips the `.monaco-workbench` click before F1; that
    // click lands in the editor and clears the selection, making `editorHasSelection` false and hiding
    // this command from the palette.
    await executeCommandWithCommandPalette(page, packageNls.query_plan_selection_text, undefined, {
      preserveSelection: true
    });

    // Get Query Plan does not prompt for API type.
    await waitForOutputChannelText(page, { expectedText: PLAN_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'soqlQueryPlan.container.05-selected-text-plan.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
