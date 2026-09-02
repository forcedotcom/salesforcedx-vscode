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
 */

import { expect } from '@playwright/test';
import {
  EDITOR,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  QUICK_INPUT_WIDGET,
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
const SOQL_FILE = `CbSoql${Date.now()}`;
const SOQL_QUERY = 'SELECT Id, Name FROM Account LIMIT 5';
// dataQuery calls the channel's show() when done, so the Output panel opens on its own.
const OUTPUT_PANEL = '[id="workbench.panel.output"]';

test('SOQL Run Query (Code Builder): executes a query against the boot org', async ({ page }) => {
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

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
