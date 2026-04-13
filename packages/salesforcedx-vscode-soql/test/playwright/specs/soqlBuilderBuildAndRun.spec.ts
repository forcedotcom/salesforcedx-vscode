/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
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

test('SOQL Builder: build query, run query, get query plan, then verify no-default-org state', async ({ page }) => {
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
    await page.keyboard.type('MySoqlBuilderFile');
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step1.file-name-entered.png');

    await waitForQuickInputFirstOption(page, { quickInputVisibleTimeout: 10_000, optionVisibleTimeout: 10_000 });
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step1.dir-selected.png');

    const soqlTab = page.locator('[role="tab"]').filter({ hasText: 'MySoqlBuilderFile.soql' });
    await expect(soqlTab, 'MySoqlBuilderFile.soql tab should be visible after opening SOQL Builder').toBeVisible({
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

    // Verify the live query preview reflects the selections
    await expect(
      soqlFrame.locator('.query-preview-container pre'),
      'query preview should show the built SOQL statement'
    ).toContainText('SELECT Id, Name FROM Account');
    await saveScreenshot(page, 'step2.query-preview-verified.png');
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
    const builderTab = page.locator('[role="tab"]').filter({ hasText: 'MySoqlBuilderFile.soql' });
    await builderTab.first().click();
    await saveScreenshot(page, 'step4.builder-tab-refocused.png');

    // Builder always uses REST API — no API-picker quick input is shown
    await soqlFrame.getByRole('button', { name: 'Get Query Plan' }).click();
    await saveScreenshot(page, 'step4.get-query-plan-clicked.png');

    // Query plan output appears in the SOQL output channel
    await ensureOutputPanelOpen(page);
    await waitForOutputChannelText(page, {
      expectedText: 'Query plan retrieved successfully',
      timeout: 30_000
    });
    await saveScreenshot(page, 'step4.query-plan-output-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
