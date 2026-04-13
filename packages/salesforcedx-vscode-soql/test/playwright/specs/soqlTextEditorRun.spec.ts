/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  clearOutputChannel,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForExtensionsActivated,
  waitForOutputChannelText,
  waitForQuickInputFirstOption
} from '@salesforce/playwright-vscode-ext';
import { test } from '../fixtures';
import packageNls from '../../../package.nls.json';

// Expected text fragments matched against the SOQL output channel after each operation.
// "records returned" comes from i18n key data_query_complete: 'Query complete with %d records returned'
// "Query plan retrieved successfully" comes from i18n key query_plan_complete
const QUERY_COMPLETE_TEXT = 'records returned';
const PLAN_COMPLETE_TEXT = 'Query plan retrieved successfully';
const SOQL_CHANNEL = 'SOQL';

test('SOQL Text Editor: code lens and commands for run query and get query plan', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup workbench', async () => {
    await setupMinimalOrgAndAuth(page);
    await waitForExtensionsActivated(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'setup.complete.png');
  });

  await test.step('create SOQL query file in text editor', async () => {
    await executeCommandWithCommandPalette(page, packageNls.soql_open_new_text_editor);
    await saveScreenshot(page, 'step1.after-command.png');

    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
    await page.keyboard.type('MySoqlTextFile');
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step1.file-name-entered.png');

    await waitForQuickInputFirstOption(page, { quickInputVisibleTimeout: 10_000, optionVisibleTimeout: 10_000 });
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step1.dir-selected.png');

    const soqlTab = page.locator('[role="tab"]').filter({ hasText: 'MySoqlTextFile.soql' });
    await expect(soqlTab, 'MySoqlTextFile.soql tab should be visible after creating file').toBeVisible({
      timeout: 20_000
    });
    await saveScreenshot(page, 'step1.soql-tab-visible.png');

    // Type a valid SOQL query so code lenses activate and commands have something to run
    await page.keyboard.type('SELECT Id, Name FROM Account LIMIT 10');
    await page.keyboard.press('Control+s');
    await saveScreenshot(page, 'step1.query-typed-and-saved.png');
  });

  await test.step('run query via "Run Query" code lens', async () => {
    // Code lenses render as buttons in VS Code desktop and links in VS Code web
    const runQueryLens = page.getByRole('button', { name: 'Run Query' });
    await expect(runQueryLens, '"Run Query" code lens should be visible at the top of the file').toBeVisible({
      timeout: 15_000
    });
    await saveScreenshot(page, 'step2.code-lens-visible.png');

    await runQueryLens.click();

    // Code lens path always shows an API-type quick pick (REST API vs Tooling API)
    await waitForQuickInputFirstOption(page, { quickInputVisibleTimeout: 10_000, optionVisibleTimeout: 10_000 });
    await page.keyboard.press('Enter'); // selects "REST API" (first option)
    await saveScreenshot(page, 'step2.api-selected.png');

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, SOQL_CHANNEL);
    await waitForOutputChannelText(page, { expectedText: QUERY_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'step2.run-query-output-verified.png');
  });

  await test.step('get query plan via "Get Query Plan" code lens', async () => {
    const soqlTab = page.locator('[role="tab"]').filter({ hasText: 'MySoqlTextFile.soql' });
    await soqlTab.click();

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, SOQL_CHANNEL);
    await clearOutputChannel(page);

    const planLens = page.getByRole('button', { name: 'Get Query Plan' });
    await expect(planLens, '"Get Query Plan" code lens should be visible').toBeVisible({ timeout: 10_000 });
    await planLens.click();

    // Get Query Plan always uses REST API — no API-picker quick input is shown
    await waitForOutputChannelText(page, { expectedText: PLAN_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'step3.get-query-plan-output-verified.png');
  });

  await test.step('execute SOQL query with current file via command palette', async () => {
    const soqlTab = page.locator('[role="tab"]').filter({ hasText: 'MySoqlTextFile.soql' });
    await soqlTab.click();

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, SOQL_CHANNEL);
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, packageNls.data_query_document_text);
    await saveScreenshot(page, 'step4.command-executed.png');

    await waitForQuickInputFirstOption(page, { quickInputVisibleTimeout: 10_000, optionVisibleTimeout: 10_000 });
    await page.keyboard.press('Enter'); // selects "REST API"

    await waitForOutputChannelText(page, { expectedText: QUERY_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'step4.current-file-query-output-verified.png');
  });

  await test.step('get SOQL query plan with current file via command palette', async () => {
    const soqlTab = page.locator('[role="tab"]').filter({ hasText: 'MySoqlTextFile.soql' });
    await soqlTab.click();

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, SOQL_CHANNEL);
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, packageNls.query_plan_document_text);
    await saveScreenshot(page, 'step5.command-executed.png');

    // Get Query Plan does not prompt for API type
    await waitForOutputChannelText(page, { expectedText: PLAN_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'step5.current-file-plan-output-verified.png');
  });

  await test.step('execute SOQL query with currently selected text via command palette', async () => {
    const soqlTab = page.locator('[role="tab"]').filter({ hasText: 'MySoqlTextFile.soql' });
    await soqlTab.click();

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, SOQL_CHANNEL);
    await clearOutputChannel(page);

    // Select all text in the editor so the command has a selection to operate on
    await soqlTab.click();
    await executeCommandWithCommandPalette(page, 'Select All');
    await saveScreenshot(page, 'step6.text-selected.png');

    await executeCommandWithCommandPalette(page, packageNls.data_query_selection_text);
    await saveScreenshot(page, 'step6.command-executed.png');

    await waitForQuickInputFirstOption(page, { quickInputVisibleTimeout: 10_000, optionVisibleTimeout: 10_000 });
    await page.keyboard.press('Enter'); // selects "REST API"

    await waitForOutputChannelText(page, { expectedText: QUERY_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'step6.selected-text-query-output-verified.png');
  });

  await test.step('get SOQL query plan with currently selected text via command palette', async () => {
    const soqlTab = page.locator('[role="tab"]').filter({ hasText: 'MySoqlTextFile.soql' });
    await soqlTab.click();

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, SOQL_CHANNEL);
    await clearOutputChannel(page);

    // Select all text in the editor so the command has a selection to operate on
    await soqlTab.click();
    await executeCommandWithCommandPalette(page, 'Select All');
    await saveScreenshot(page, 'step7.text-selected.png');

    await executeCommandWithCommandPalette(page, packageNls.query_plan_selection_text);
    await saveScreenshot(page, 'step7.command-executed.png');

    // Get Query Plan does not prompt for API type
    await waitForOutputChannelText(page, { expectedText: PLAN_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'step7.selected-text-plan-output-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
