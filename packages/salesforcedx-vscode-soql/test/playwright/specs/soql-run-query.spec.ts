/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  clearOutputChannel,
  EDITOR,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForExtensionsActivated,
  waitForOutputChannelText,
  waitForQuickInputFirstOption
} from '@salesforce/playwright-vscode-ext';
import { test } from '../fixtures';
import packageNls from '../../../package.nls.json';

// "records returned" comes from i18n key data_query_complete: 'Query complete with %d records returned'
const QUERY_COMPLETE_TEXT = 'records returned';
const SOQL_CHANNEL = 'SOQL';
const SOQL_FILE = 'MySoqlRunQueryFile';
const SOQL_QUERY = 'SELECT Id, Name FROM Account LIMIT 10';
// dataQuery calls vscChannel.show() when done — the Output panel opens automatically.
// Waiting for it directly avoids racing with ensureOutputPanelOpen.
const OUTPUT_PANEL = '[id="workbench.panel.output"]';

test('SOQL Run Query: code lens, current file, selected text via command palette', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup workbench', async () => {
    await setupMinimalOrgAndAuth(page);
    await waitForExtensionsActivated(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'setup.complete.png');
    await verifyCommandExists(page, packageNls.soql_open_new_text_editor);
  });

  await test.step('create SOQL file via text editor command', async () => {
    await executeCommandWithCommandPalette(page, packageNls.soql_open_new_text_editor);
    await saveScreenshot(page, 'step1.after-command.png');

    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
    await page.keyboard.type(SOQL_FILE);
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step1.file-name-entered.png');

    await waitForQuickInputFirstOption(page, { quickInputVisibleTimeout: 10_000, optionVisibleTimeout: 10_000 });
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step1.dir-selected.png');

    const soqlTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
    await expect(soqlTab, `${SOQL_FILE}.soql tab should be visible`).toBeVisible({ timeout: 20_000 });
    await saveScreenshot(page, 'step1.soql-tab-visible.png');

    // Type the query into the empty editor (file opens focused and ready for input)
    await page.locator(EDITOR).first().click();
    await page.keyboard.type(SOQL_QUERY);
    await executeCommandWithCommandPalette(page, 'File: Save');
    await saveScreenshot(page, 'step1.query-saved.png');
  });

  await test.step('run query via "Run Query" code lens', async () => {
    const runQueryLens = page.getByRole('button', { name: 'Run Query' });
    await expect(runQueryLens, '"Run Query" code lens should be visible').toBeVisible({ timeout: 15_000 });
    await saveScreenshot(page, 'step2.code-lens-visible.png');

    await runQueryLens.click();

    // Code lens path always shows an API-type quick pick (REST API vs Tooling API)
    await waitForQuickInputFirstOption(page, { quickInputVisibleTimeout: 10_000, optionVisibleTimeout: 10_000 });
    await page.keyboard.press('Enter'); // selects "REST API" (first option)
    await saveScreenshot(page, 'step2.api-selected.png');

    // dataQuery calls vscChannel.show() when done — wait for the panel to open naturally
    await page.locator(OUTPUT_PANEL).waitFor({ state: 'visible', timeout: 30_000 });
    await selectOutputChannel(page, SOQL_CHANNEL);
    await waitForOutputChannelText(page, { expectedText: QUERY_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'step2.run-query-output-verified.png');
  });

  await test.step('execute SOQL query with current file via command palette', async () => {
    const soqlTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
    await soqlTab.click();

    await selectOutputChannel(page, SOQL_CHANNEL);
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, packageNls.data_query_document_text);
    await saveScreenshot(page, 'step3.command-executed.png');

    await waitForQuickInputFirstOption(page, { quickInputVisibleTimeout: 10_000, optionVisibleTimeout: 10_000 });
    await page.keyboard.press('Enter'); // selects "REST API"

    await waitForOutputChannelText(page, { expectedText: QUERY_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'step3.current-file-query-output-verified.png');
  });

  await test.step('execute SOQL query with currently selected text via command palette', async () => {
    const soqlTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
    await soqlTab.click();

    await selectOutputChannel(page, SOQL_CHANNEL);
    await clearOutputChannel(page);

    // Select all text in the editor so the command has a selection to operate on
    await soqlTab.click();
    await executeCommandWithCommandPalette(page, 'Select All');
    await saveScreenshot(page, 'step4.text-selected.png');

    await executeCommandWithCommandPalette(page, packageNls.data_query_selection_text);
    await saveScreenshot(page, 'step4.command-executed.png');

    await waitForQuickInputFirstOption(page, { quickInputVisibleTimeout: 10_000, optionVisibleTimeout: 10_000 });
    await page.keyboard.press('Enter'); // selects "REST API"

    await waitForOutputChannelText(page, { expectedText: QUERY_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'step4.selected-text-query-output-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
