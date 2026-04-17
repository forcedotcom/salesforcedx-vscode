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

// "Query plan retrieved successfully" comes from i18n key query_plan_complete
const PLAN_COMPLETE_TEXT = 'Query plan retrieved successfully';
const SOQL_CHANNEL = 'SOQL';
const SOQL_FILE = 'MySoqlQueryPlanFile';
const SOQL_QUERY = 'SELECT Id, Name FROM Account LIMIT 10';
// executeQueryPlan calls vscChannel.show() in its finally block — the Output panel opens automatically.
// Waiting for it directly avoids racing with ensureOutputPanelOpen.
const OUTPUT_PANEL = '[id="workbench.panel.output"]';

test('SOQL Query Plan: code lens, current file, selected text via command palette', async ({ page }) => {
  test.setTimeout(180_000);
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

  await test.step('get query plan via "Get Query Plan" code lens', async () => {
    const planLens = page.getByRole('button', { name: 'Get Query Plan' });
    await expect(planLens, '"Get Query Plan" code lens should be visible').toBeVisible({ timeout: 15_000 });
    await saveScreenshot(page, 'step2.code-lens-visible.png');

    await planLens.click();

    // Get Query Plan always uses REST API — no API-picker quick input is shown
    // executeQueryPlan calls vscChannel.show() in finally — wait for the panel to open naturally
    await page.locator(OUTPUT_PANEL).waitFor({ state: 'visible', timeout: 30_000 });
    await selectOutputChannel(page, SOQL_CHANNEL);
    await waitForOutputChannelText(page, { expectedText: PLAN_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'step2.get-query-plan-output-verified.png');
  });

  await test.step('get query plan with current file via command palette', async () => {
    const soqlTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
    await soqlTab.click();

    await selectOutputChannel(page, SOQL_CHANNEL);
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, packageNls.query_plan_document_text);
    await saveScreenshot(page, 'step3.command-executed.png');

    // Get Query Plan does not prompt for API type
    await waitForOutputChannelText(page, { expectedText: PLAN_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'step3.current-file-plan-output-verified.png');
  });

  await test.step('get query plan with currently selected text via command palette', async () => {
    const soqlTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
    await soqlTab.click();

    await selectOutputChannel(page, SOQL_CHANNEL);
    await clearOutputChannel(page);

    // Select all text in the editor so the command has a selection to operate on
    await soqlTab.click();
    await executeCommandWithCommandPalette(page, 'Select All');
    await saveScreenshot(page, 'step4.text-selected.png');

    await executeCommandWithCommandPalette(page, packageNls.query_plan_selection_text);
    await saveScreenshot(page, 'step4.command-executed.png');

    // Get Query Plan does not prompt for API type
    await waitForOutputChannelText(page, { expectedText: PLAN_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'step4.selected-text-plan-output-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
