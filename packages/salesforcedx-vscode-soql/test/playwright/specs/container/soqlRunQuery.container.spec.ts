/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for running a SOQL query (ADR 0022). The web twin (soql-run-query.spec.ts) proves
 * the flow against a plain Page; this proves a query actually executes against the org from inside
 * the Code Builder image, using the container's boot-authed org. Queries a standard object
 * (`Account` exists on every org) so it needs no deploy. Creates the `.soql` via the extension's own
 * "Create SOQL Query" command (opens a text editor — opening a committed `.soql` would launch the
 * SOQL Builder webview instead), so nothing is committed to the shared fixture.
 *
 * Restores full parity with the twin's 5 execution flows (W-23898526): the "Run Query" code lens
 * (REST), current-file via command palette (REST), selected-text via command palette (REST), the
 * Tooling API path (ApexClass), and ALL ROWS → /queryAll routing. Each flow asserts the SOQL output
 * channel's "records returned" completion text. Backend routing (REST vs Tooling, ALL ROWS →
 * scanAll/queryAll) is not verified by network interception: the desktop extension build makes the
 * org HTTP call from the Node extension host, which is invisible to Playwright's Chromium page — so
 * this matches the twin, which also relies on "records returned" as the durable cross-mode signal
 * (soql-run-query.spec.ts:228-231).
 */

import { expect } from '@playwright/test';
import {
  clearOutputChannel,
  EDITOR,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  QUICK_INPUT_WIDGET,
  resetContainerWorkbench,
  saveFile,
  saveScreenshot,
  selectOutputChannel,
  selectQuickInputOption,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText,
  waitForQuickInputFirstOption
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

// "records returned" comes from i18n data_query_complete: 'Query complete with %d records returned'.
const QUERY_COMPLETE_TEXT = 'records returned';
const SOQL_CHANNEL = 'SOQL';
// Unique per run so the shared, persistent workbench never collides across specs or retries.
const SOQL_FILE = `CbSoql${Date.now()}`;
const SOQL_QUERY = 'SELECT Id, Name FROM Account LIMIT 5';
// dataQuery calls the channel's show() when done, so the Output panel opens on its own.
const OUTPUT_PANEL = '[id="workbench.panel.output"]';

// Shared persistent workbench: reset editors + notifications so each spec starts from a known state.
test.beforeEach(async ({ page }) => {
  await resetContainerWorkbench(page);
});

test('SOQL Run Query (Code Builder): code lens, current file, selected text, Tooling API, ALL ROWS', async ({
  page
}) => {
  test.setTimeout(5 * 60 * 1000);
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
    await saveScreenshot(page, 'soqlRun.container.01-query-saved.png');
  });

  await test.step('run the query via the "Run Query" code lens and assert results', async () => {
    const runQueryLens = page.getByRole('button', { name: 'Run Query' });
    await expect(runQueryLens, '"Run Query" code lens should be visible').toBeVisible({ timeout: 15_000 });
    await runQueryLens.click();

    // The code-lens path always shows a REST API vs Tooling API quick pick. Click the option rather
    // than pressing Enter — Enter is unreliable on the active quick pick in this host.
    await selectQuickInputOption(page, /^REST API/, {
      quickInputVisibleTimeout: 10_000,
      optionVisibleTimeout: 10_000
    });

    await page.locator(OUTPUT_PANEL).waitFor({ state: 'visible', timeout: 30_000 });
    await selectOutputChannel(page, SOQL_CHANNEL);
    await waitForOutputChannelText(page, { expectedText: QUERY_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'soqlRun.container.02-results.png');
  });

  await test.step('execute SOQL query with current file via command palette', async () => {
    const soqlTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
    await soqlTab.click();

    await selectOutputChannel(page, SOQL_CHANNEL);
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, packageNls.data_query_document_text);

    await selectQuickInputOption(page, /^REST API/, {
      quickInputVisibleTimeout: 10_000,
      optionVisibleTimeout: 10_000
    });

    await waitForOutputChannelText(page, { expectedText: QUERY_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'soqlRun.container.03-current-file-results.png');
  });

  await test.step('execute SOQL query with currently selected text via command palette', async () => {
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
    // Sanity check: VS Code's status bar shows "(N selected)" only when the active editor has a real,
    // non-empty selection. If this never appears, the triple-click didn't reach Monaco and the palette
    // command would be hidden by `editorHasSelection`.
    await expect(
      page
        .locator('.statusbar-item')
        .filter({ hasText: /\(\d+ selected\)/ })
        .first()
    ).toBeVisible({ timeout: 5000 });
    await saveScreenshot(page, 'soqlRun.container.04-text-selected.png');

    // Pass preserveSelection so the shared helper skips the `.monaco-workbench` click before F1; that
    // click lands in the editor and clears the selection, making `editorHasSelection` false and hiding
    // this command from the palette.
    await executeCommandWithCommandPalette(page, packageNls.data_query_selection_text, undefined, {
      preserveSelection: true
    });

    await selectQuickInputOption(page, /^REST API/, {
      quickInputVisibleTimeout: 10_000,
      optionVisibleTimeout: 10_000
    });

    await waitForOutputChannelText(page, { expectedText: QUERY_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'soqlRun.container.05-selected-text-results.png');
  });

  await test.step('run query via Tooling API', async () => {
    const soqlTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
    await soqlTab.click();

    await selectOutputChannel(page, SOQL_CHANNEL);
    await clearOutputChannel(page);

    // Overwrite the query with a Tooling-only object to exercise the Tooling API branch. ApexClass is
    // a Tooling API object present on every org; "records returned" (even with 0 rows) proves the
    // query completed against /tooling, which the REST path could not serve.
    const soqlEditor = page.locator(`${EDITOR}[data-uri$="${SOQL_FILE}.soql"]`);
    await soqlEditor.locator('.view-line').first().click({ clickCount: 3 });
    await expect(
      page
        .locator('.statusbar-item')
        .filter({ hasText: /\(\d+ selected\)/ })
        .first()
    ).toBeVisible({ timeout: 5000 });
    await page.keyboard.type('SELECT Id, Name FROM ApexClass LIMIT 5');
    await saveFile(page);
    await saveScreenshot(page, 'soqlRun.container.06-tooling-query-saved.png');

    const runQueryLens = page.getByRole('button', { name: 'Run Query' });
    await expect(runQueryLens, '"Run Query" code lens should be visible').toBeVisible({ timeout: 15_000 });
    await runQueryLens.click();

    await selectQuickInputOption(page, /^Tooling API/, {
      quickInputVisibleTimeout: 10_000,
      optionVisibleTimeout: 10_000
    });
    await saveScreenshot(page, 'soqlRun.container.07-tooling-api-selected.png');

    await waitForOutputChannelText(page, { expectedText: QUERY_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'soqlRun.container.08-tooling-results.png');
  });

  await test.step('run query ending in ALL ROWS routes to /queryAll', async () => {
    const soqlTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
    await soqlTab.click();

    await selectOutputChannel(page, SOQL_CHANNEL);
    await clearOutputChannel(page);

    // Overwrite with a query whose trailing ALL ROWS must be stripped before send and routed to /queryAll.
    const soqlEditor = page.locator(`${EDITOR}[data-uri$="${SOQL_FILE}.soql"]`);
    await soqlEditor.locator('.view-line').first().click({ clickCount: 3 });
    await expect(
      page
        .locator('.statusbar-item')
        .filter({ hasText: /\(\d+ selected\)/ })
        .first()
    ).toBeVisible({ timeout: 5000 });
    await page.keyboard.type('SELECT Id, Name FROM Account LIMIT 5 ALL ROWS');
    await saveFile(page);
    await saveScreenshot(page, 'soqlRun.container.09-all-rows-query-saved.png');

    const runQueryLens = page.getByRole('button', { name: 'Run Query' });
    await expect(runQueryLens, '"Run Query" code lens should be visible').toBeVisible({ timeout: 15_000 });
    await runQueryLens.click();
    await selectQuickInputOption(page, /^REST API/, {
      quickInputVisibleTimeout: 10_000,
      optionVisibleTimeout: 10_000
    });

    // Query completing is the durable cross-mode signal that the strip-and-route worked: the org rejects
    // literal ALL ROWS on /queryAll, so a successful "records returned" proves the clause was stripped and
    // routed via scanAll. Network interception via waitForRequest is not available here — the desktop
    // extension build makes the org HTTP call from the Node extension host, invisible to Playwright's
    // Chromium page (same limitation the twin documents at soql-run-query.spec.ts:230-231).
    await waitForOutputChannelText(page, { expectedText: QUERY_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'soqlRun.container.10-all-rows-results.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
