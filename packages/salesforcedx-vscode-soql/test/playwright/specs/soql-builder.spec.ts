/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  activeQuickInputWidget,
  closeEditor,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  hidePanel,
  saveFile,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  startVideoRecording,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForExtensionsActivated,
  waitForNotification,
  waitForOutputChannelText,
  waitForQuickInputFirstOption
} from '@salesforce/playwright-vscode-ext';
import { test } from '../fixtures';
import packageNls from '../../../package.nls.json';

// "Query plan retrieved successfully" comes from i18n key query_plan_complete
const PLAN_COMPLETE_TEXT = 'Query plan retrieved successfully';
const SOQL_CHANNEL = 'SOQL';
const SOQL_FILE = 'MySoqlBuilderFile';
// executeQueryPlan always calls vscChannel.show() in its finally block — the Output panel
// opens automatically. Waiting for it directly avoids racing with ensureOutputPanelOpen.
const OUTPUT_PANEL = '[id="workbench.panel.output"]';

test('SOQL Builder: build query, run, get plan, toggle round-trip', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // soqlFrame is initialized after the builder tab opens and reused across all builder steps
  let soqlFrame: ReturnType<typeof page.frameLocator>;

  await test.step('setup workbench', async () => {
    await setupMinimalOrgAndAuth(page);
    await waitForExtensionsActivated(page);
    await ensureSecondarySideBarHidden(page);
    await verifyCommandExists(page, packageNls.soql_open_new_builder);
  });

  const videoName = [testInfo.project.name, ...testInfo.titlePath, 'query-builder', `retry-${testInfo.retry}`]
    .join('-')
    .replaceAll(/[^a-zA-Z0-9._-]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');
  const stopRecording = await startVideoRecording(page, testInfo, videoName);
  try {
    await test.step('open SOQL Builder', async () => {
      await executeCommandWithCommandPalette(page, packageNls.soql_open_new_builder);

      const quickInput = activeQuickInputWidget(page);
      await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
      await page.keyboard.type(SOQL_FILE);
      await page.keyboard.press('Enter');

      await waitForQuickInputFirstOption(page, { quickInputVisibleTimeout: 10_000, optionVisibleTimeout: 10_000 });
      await page.keyboard.press('Enter');

      const soqlTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
      await expect(soqlTab, `${SOQL_FILE}.soql tab should be visible after opening SOQL Builder`).toBeVisible({
        timeout: 20_000
      });

      soqlFrame = page.frameLocator('iframe.webview.ready').frameLocator('#active-frame');
    });

    await test.step('build a query using the SOQL Builder dropdowns', async () => {
      // Select sObject: Account
      await soqlFrame.getByPlaceholder('Search object...').click();
      await soqlFrame.getByPlaceholder('Search object...').fill('Account');
      await soqlFrame.locator('p.option[data-option-value="Account"]').click();

      // Select fields: Id and Name
      await soqlFrame.getByPlaceholder('Search fields...').first().click();
      await soqlFrame.locator('querybuilder-fields p.option[data-option-value="Id"]').click();
      await soqlFrame.getByPlaceholder('Search fields...').first().click();
      await soqlFrame.locator('querybuilder-fields p.option[data-option-value="Name"]').click();

      // Set LIMIT to 10 and press Tab to blur and trigger the change event
      await soqlFrame.getByPlaceholder('Limit...').fill('10');
      await soqlFrame.getByPlaceholder('Limit...').press('Tab');

      // Add WHERE condition: Name != 'Test' (selecting NOT_EQ to exercise non-default operator)
      const whereSection = soqlFrame.locator('querybuilder-where');
      await whereSection.getByPlaceholder('Search fields...').click();
      await whereSection.locator('p.option[data-option-value="Name"]').click();

      await whereSection.locator('[data-el-where-operator-input]').selectOption({ value: 'NOT_EQ' });
      await whereSection.locator('[data-el-where-criteria-input]').fill('Test');
      // Blur to trigger debounced change event
      await whereSection.locator('[data-el-where-criteria-input]').press('Tab');

      await expect(
        soqlFrame.locator('.query-preview-container pre'),
        'query preview should include WHERE clause'
      ).toContainText("WHERE Name != 'Test'");

      // Add ORDER BY: Name DESC
      const orderBySection = soqlFrame.locator('querybuilder-order-by');
      await orderBySection.getByPlaceholder('Search fields...').click();
      await orderBySection.locator('p.option[data-option-value="Name"]').click();

      await orderBySection.locator('[data-el-orderby-order]').selectOption({ value: 'DESC' });
      await orderBySection.locator('[data-el-add-button]').click();

      await expect(
        soqlFrame.locator('.query-preview-container pre'),
        'query preview should include ORDER BY clause'
      ).toContainText('ORDER BY Name DESC');

      // Verify the live query preview reflects all selections
      await expect(
        soqlFrame.locator('.query-preview-container pre'),
        'query preview should show the built SOQL statement'
      ).toContainText("SELECT Id, Name FROM Account WHERE Name != 'Test' ORDER BY Name DESC LIMIT 10");

      // Toggle ALL ROWS on: preview should include the ALL ROWS clause
      await soqlFrame.locator('[data-el-all-rows]').check();
      await expect(
        soqlFrame.locator('.query-preview-container pre'),
        'query preview should include ALL ROWS when checkbox is checked'
      ).toContainText('ALL ROWS');

      // Toggle ALL ROWS off: preview should no longer include the ALL ROWS clause
      await soqlFrame.locator('[data-el-all-rows]').uncheck();
      await expect(
        soqlFrame.locator('.query-preview-container pre'),
        'query preview should not include ALL ROWS when checkbox is unchecked'
      ).not.toContainText('ALL ROWS');

      await saveFile(page);
    });

    await test.step('run query from SOQL Builder', async () => {
      // Builder always uses REST API — no API-picker quick input is shown
      await soqlFrame.getByRole('button', { name: 'Run Query' }).click();

      // Results open in a dedicated "SOQL Query Results" webview panel
      const resultsTab = page.locator('[role="tab"]').filter({ hasText: 'SOQL Query Results' });
      await expect(resultsTab, 'SOQL Query Results tab should appear after running query').toBeVisible({
        timeout: 30_000
      });

      // Close the results panel so only one webview iframe exists when interacting with the builder next
      await resultsTab.click();
      await closeEditor(page);
      await expect(resultsTab, 'SOQL Query Results tab should be closed').not.toBeVisible({ timeout: 10_000 });
    });

    await test.step('toast when SOQL Builder Run Query fails', async () => {
      const builderTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
      await builderTab.first().click();
      const whereSection = soqlFrame.locator('querybuilder-where');
      await whereSection.locator('[data-el-where-add-btn]').click();
      const badCondition = whereSection.locator('querybuilder-where-modifier-group').nth(1);
      await badCondition.getByPlaceholder('Search fields...').click();
      await badCondition.locator('p.option[data-option-value="Id"]').click();
      await badCondition.locator('[data-el-where-criteria-input]').fill('not-an-id');
      await badCondition.locator('[data-el-where-criteria-input]').press('Tab');
      await expect(
        soqlFrame.locator('.query-preview-container pre'),
        'query preview should include the id filter the org rejects'
      ).toContainText("Id = 'not-an-id'");

      await soqlFrame.getByRole('button', { name: 'Run Query' }).click();
      await waitForNotification(page, /We can't run the SOQL query\./, { timeout: 30_000 });

      await badCondition.locator('[data-el-where-delete]').click();
      await expect(
        soqlFrame.locator('.query-preview-container pre'),
        'query preview should drop the rejected id filter'
      ).not.toContainText("Id = 'not-an-id'");
    });

    await test.step('get query plan from SOQL Builder', async () => {
      // Bring the builder back into focus so its buttons are accessible
      const builderTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
      await builderTab.first().click();

      // Builder always uses REST API — no API-picker quick input is shown
      await soqlFrame.getByRole('button', { name: 'Get Query Plan' }).click();

      // executeQueryPlan calls vscChannel.show() when done — wait for the panel to open naturally
      await page.locator(OUTPUT_PANEL).waitFor({ state: 'visible', timeout: 30_000 });
      await selectOutputChannel(page, SOQL_CHANNEL);
      await waitForOutputChannelText(page, {
        expectedText: PLAN_COMPLETE_TEXT,
        timeout: 30_000
      });

      await hidePanel(page);
    });

    await test.step('toggle from SOQL Builder to Text Editor', async () => {
      const builderTab = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
      await builderTab.first().click();

      const toggleButton = page.getByRole('button', { name: packageNls.soql_builder_toggle });
      await expect(toggleButton, 'toggle button should be visible in editor title').toBeVisible();
      await toggleButton.click();

      // After toggling, a second MySoqlBuilderFile.soql tab opens (text editor alongside builder)
      const soqlTabs = page.locator('[role="tab"]').filter({ hasText: `${SOQL_FILE}.soql` });
      await expect(soqlTabs, `two ${SOQL_FILE}.soql tabs should exist after toggling to text editor`).toHaveCount(2, {
        timeout: 10_000
      });
    });

    await test.step('toggle from Text Editor back to SOQL Builder', async () => {
      // We are now in the text editor view; toggle should switch focus back to the builder
      const toggleButton = page.getByRole('button', { name: packageNls.soql_builder_toggle });
      await expect(toggleButton, 'toggle button should be visible from text editor').toBeVisible();
      await toggleButton.click();

      // Verify the active tab is MySoqlBuilderFile.soql (builder view now active)
      const activeTab = page.locator('[role="tab"][aria-selected="true"]').filter({ hasText: `${SOQL_FILE}.soql` });
      await expect(activeTab, `active tab should be ${SOQL_FILE}.soql after toggling back to builder`).toBeVisible({
        timeout: 10_000
      });
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  } finally {
    await stopRecording();
  }
});
