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
  verifyCommandExists,
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
const SOQL_FILE = 'MySoqlFile';

test('SOQL: build query in builder, toggle to text editor, run queries and get query plans', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // soqlFrame is initialized after the builder tab opens and reused across all builder steps
  let soqlFrame: ReturnType<typeof page.frameLocator>;

  await test.step('setup workbench', async () => {
    await setupMinimalOrgAndAuth(page);
    await waitForExtensionsActivated(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'setup.complete.png');
    await verifyCommandExists(page, packageNls.soql_open_new_builder);
  });

  await test.step('open SOQL Builder', async () => {
    await executeCommandWithCommandPalette(page, packageNls.soql_open_new_builder);
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
    await expect(soqlTab, `${SOQL_FILE}.soql tab should be visible after opening SOQL Builder`).toBeVisible({
      timeout: 20_000
    });
    await saveScreenshot(page, 'step1.soql-tab-visible.png');

    soqlFrame = page.frameLocator('iframe.webview.ready').frameLocator('#active-frame');
  });

  await test.step('build a query using the SOQL Builder dropdowns', async () => {
    // Select sObject: Account
    await soqlFrame.getByPlaceholder('Search object...').click();
    await soqlFrame.getByPlaceholder('Search object...').fill('Account');
    await soqlFrame.locator('p.option[data-option-value="Account"]').click();
    await saveScreenshot(page, 'step2.account-selected.png');

    // Select fields: Id and Name
    await soqlFrame.getByPlaceholder('Search fields...').first().click();
    await soqlFrame.locator('querybuilder-fields p.option[data-option-value="Id"]').click();
    await soqlFrame.getByPlaceholder('Search fields...').first().click();
    await soqlFrame.locator('querybuilder-fields p.option[data-option-value="Name"]').click();
    await saveScreenshot(page, 'step2.fields-selected.png');

    // Set LIMIT to 10 and click away to trigger the change event
    await soqlFrame.getByPlaceholder('Limit...').fill('10');
    await soqlFrame.getByPlaceholder('Search object...').click();
    await saveScreenshot(page, 'step2.limit-set.png');

    // Verify the live query preview reflects all selections
    await expect(
      soqlFrame.locator('.query-preview-container pre'),
      'query preview should show the built SOQL statement'
    ).toContainText('SELECT Id, Name FROM Account LIMIT 10');
    await saveScreenshot(page, 'step2.query-preview-verified.png');

    await executeCommandWithCommandPalette(page, 'File: Save');
    await saveScreenshot(page, 'step2.query-saved.png');
  });

  await test.step('run query from SOQL Builder', async () => {
    // Builder always uses REST API — no API-picker quick input is shown
    await soqlFrame.getByRole('button', { name: 'Run Query' }).click();
    await saveScreenshot(page, 'step3.run-query-clicked.png');

    // Results open in a dedicated "SOQL Query Results" webview panel
    const resultsTab = page.locator('[role="tab"]').filter({ hasText: 'SOQL Query Results' });
    await expect(resultsTab, 'SOQL Query Results tab should appear after running query').toBeVisible({
      timeout: 30_000
    });
    await saveScreenshot(page, 'step3.results-tab-visible.png');

    // Close the results panel so only one webview iframe exists when interacting with the builder next
    await resultsTab.click();
    await executeCommandWithCommandPalette(page, 'View: Close Editor');
    await expect(resultsTab, 'SOQL Query Results tab should be closed').not.toBeVisible({ timeout: 10_000 });
  });

  await test.step('get query plan from SOQL Builder', async () => {
    // Bring the builder back into focus so its buttons are accessible
    const builderTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
    await builderTab.first().click();
    await saveScreenshot(page, 'step4.builder-tab-refocused.png');

    // Open output panel before clicking so the command palette is not open when
    // the async query plan operation completes (completion event can dismiss the palette)
    await ensureOutputPanelOpen(page);

    // Builder always uses REST API — no API-picker quick input is shown
    await soqlFrame.getByRole('button', { name: 'Get Query Plan' }).click();
    await saveScreenshot(page, 'step4.get-query-plan-clicked.png');

    // Query plan output appears in the SOQL output channel
    await waitForOutputChannelText(page, {
      expectedText: PLAN_COMPLETE_TEXT,
      timeout: 30_000
    });
    await saveScreenshot(page, 'step4.query-plan-output-verified.png');

    await executeCommandWithCommandPalette(page, 'View: Hide Panel');
  });

  await test.step('toggle from SOQL Builder to Text Editor', async () => {
    const builderTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
    await builderTab.first().click();

    const toggleButton = page.getByRole('button', { name: packageNls.soql_builder_toggle });
    await expect(toggleButton, 'toggle button should be visible in editor title').toBeVisible();
    await toggleButton.click();
    await saveScreenshot(page, 'step5.after-toggle-to-text.png');

    // After toggling, a second MySoqlFile.soql tab opens (text editor alongside builder)
    const soqlTabs = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
    await expect(soqlTabs, `two ${SOQL_FILE}.soql tabs should exist after toggling to text editor`).toHaveCount(2, {
      timeout: 10_000
    });
    await saveScreenshot(page, 'step5.two-tabs-visible.png');
  });

  await test.step('run query via "Run Query" code lens', async () => {
    // Code lenses render as buttons in VS Code desktop
    const runQueryLens = page.getByRole('button', { name: 'Run Query' });
    await expect(runQueryLens, '"Run Query" code lens should be visible at the top of the file').toBeVisible({
      timeout: 15_000
    });
    await saveScreenshot(page, 'step6.code-lens-visible.png');

    await runQueryLens.click();

    // Code lens path always shows an API-type quick pick (REST API vs Tooling API)
    await waitForQuickInputFirstOption(page, { quickInputVisibleTimeout: 10_000, optionVisibleTimeout: 10_000 });
    await page.keyboard.press('Enter'); // selects "REST API" (first option)
    await saveScreenshot(page, 'step6.api-selected.png');

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, SOQL_CHANNEL);
    await waitForOutputChannelText(page, { expectedText: QUERY_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'step6.run-query-output-verified.png');
  });

  await test.step('get query plan via "Get Query Plan" code lens', async () => {
    const soqlTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
    await soqlTab.last().click();

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, SOQL_CHANNEL);
    await clearOutputChannel(page);

    const planLens = page.getByRole('button', { name: 'Get Query Plan' });
    await expect(planLens, '"Get Query Plan" code lens should be visible').toBeVisible({ timeout: 10_000 });
    await planLens.click();

    // Get Query Plan always uses REST API — no API-picker quick input is shown
    await waitForOutputChannelText(page, { expectedText: PLAN_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'step7.get-query-plan-output-verified.png');
  });

  await test.step('execute SOQL query with current file via command palette', async () => {
    const soqlTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
    await soqlTab.last().click();

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, SOQL_CHANNEL);
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, packageNls.data_query_document_text);
    await saveScreenshot(page, 'step8.command-executed.png');

    await waitForQuickInputFirstOption(page, { quickInputVisibleTimeout: 10_000, optionVisibleTimeout: 10_000 });
    await page.keyboard.press('Enter'); // selects "REST API"

    await waitForOutputChannelText(page, { expectedText: QUERY_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'step8.current-file-query-output-verified.png');
  });

  await test.step('get SOQL query plan with current file via command palette', async () => {
    const soqlTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
    await soqlTab.last().click();

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, SOQL_CHANNEL);
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, packageNls.query_plan_document_text);
    await saveScreenshot(page, 'step9.command-executed.png');

    // Get Query Plan does not prompt for API type
    await waitForOutputChannelText(page, { expectedText: PLAN_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'step9.current-file-plan-output-verified.png');
  });

  await test.step('execute SOQL query with currently selected text via command palette', async () => {
    const soqlTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
    await soqlTab.last().click();

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, SOQL_CHANNEL);
    await clearOutputChannel(page);

    // Select all text in the editor so the command has a selection to operate on
    await soqlTab.last().click();
    await executeCommandWithCommandPalette(page, 'Select All');
    await saveScreenshot(page, 'step10.text-selected.png');

    await executeCommandWithCommandPalette(page, packageNls.data_query_selection_text);
    await saveScreenshot(page, 'step10.command-executed.png');

    await waitForQuickInputFirstOption(page, { quickInputVisibleTimeout: 10_000, optionVisibleTimeout: 10_000 });
    await page.keyboard.press('Enter'); // selects "REST API"

    await waitForOutputChannelText(page, { expectedText: QUERY_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'step10.selected-text-query-output-verified.png');
  });

  await test.step('get SOQL query plan with currently selected text via command palette', async () => {
    const soqlTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
    await soqlTab.last().click();

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, SOQL_CHANNEL);
    await clearOutputChannel(page);

    // Select all text in the editor so the command has a selection to operate on
    await soqlTab.last().click();
    await executeCommandWithCommandPalette(page, 'Select All');
    await saveScreenshot(page, 'step11.text-selected.png');

    await executeCommandWithCommandPalette(page, packageNls.query_plan_selection_text);
    await saveScreenshot(page, 'step11.command-executed.png');

    // Get Query Plan does not prompt for API type
    await waitForOutputChannelText(page, { expectedText: PLAN_COMPLETE_TEXT, timeout: 30_000 });
    await saveScreenshot(page, 'step11.selected-text-plan-output-verified.png');
  });

  await test.step('toggle from Text Editor back to SOQL Builder', async () => {
    // We are now in the text editor view; toggle should switch focus back to the builder
    const toggleButton = page.getByRole('button', { name: packageNls.soql_builder_toggle });
    await expect(toggleButton, 'toggle button should be visible from text editor').toBeVisible();
    await toggleButton.click();
    await saveScreenshot(page, 'step12.after-toggle-to-builder.png');

    // Verify the active tab is still MySoqlFile.soql (builder view now active)
    const activeTab = page.locator('[role="tab"][aria-selected="true"]').filter({ hasText: `${SOQL_FILE}.soql` });
    await expect(activeTab, `active tab should be ${SOQL_FILE}.soql after toggling back to builder`).toBeVisible({
      timeout: 10_000
    });
    await saveScreenshot(page, 'step12.builder-active.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
