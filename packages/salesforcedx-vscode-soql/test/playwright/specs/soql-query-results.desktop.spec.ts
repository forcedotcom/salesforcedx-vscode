/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import { expect } from '@playwright/test';
import {
  clearAllNotifications,
  createMinimalOrg,
  EDITOR,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  hasContent,
  hasTitle,
  isDesktop,
  QUICK_INPUT_WIDGET,
  saveFile,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForExtensionsActivated,
  waitForNotification,
  waitForQuickInputFirstOption,
  webviewActiveFrame
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { messages } from '../../../src/messages/i18n';
import { test } from '../fixtures';

const SOQL_FILE = 'W23752055QueryResults';
const RECORD_COUNT = 55;

test.describe.configure({ timeout: 240_000 });

test('SOQL query results: relationship columns, pagination, resize, restoration, and exports', async ({ page }) => {
  test.skip(!isDesktop(), 'Desktop-only coverage resizes the VS Code window and seeds records through Salesforce Core');

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const recordPrefix = `W23752055-${Date.now()}`;
  const accountNames = Array.from(
    { length: RECORD_COUNT },
    (_unused, index) => `${recordPrefix}-${String(index + 1).padStart(2, '0')}`
  );
  let connection: Connection | undefined;
  const accountIds: string[] = [];

  try {
    await test.step('setup workbench and query records', async () => {
      await setupMinimalOrgAndAuth(page);
      await waitForExtensionsActivated(page);
      await ensureSecondarySideBarHidden(page);

      const orgAuth = await createMinimalOrg();
      const authInfo = await AuthInfo.create({
        accessTokenOptions: {
          accessToken: orgAuth.accessToken,
          instanceUrl: orgAuth.instanceUrl,
          loginUrl: orgAuth.instanceUrl
        }
      });
      connection = await Connection.create({ authInfo });
      const results = await connection.sobject('Account').create(accountNames.map(Name => ({ Name })));
      accountIds.push(...results.flatMap(result => (result.id ? [result.id] : [])));
      const failures = results.filter(result => !result.success || !result.id);
      expect(failures, 'all pagination records should be created').toEqual([]);
    });

    await test.step('create and run relationship query', async () => {
      await executeCommandWithCommandPalette(page, packageNls.soql_open_new_text_editor);
      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
      await page.keyboard.type(SOQL_FILE);
      await page.keyboard.press('Enter');
      await waitForQuickInputFirstOption(page);
      await page.keyboard.press('Enter');

      const soqlTab = page.getByRole('tab', { name: `${SOQL_FILE}.soql` });
      await expect(soqlTab, 'query editor should open').toBeVisible({ timeout: 20_000 });
      const editor = page.locator(`${EDITOR}[data-uri$="${SOQL_FILE}.soql"]`);
      await editor.click();
      await page.keyboard.type(
        `SELECT Id, Name, Owner.Name FROM Account WHERE Name LIKE '${recordPrefix}%' ORDER BY Name`
      );
      await saveFile(page);

      await page.getByRole('button', { name: packageNls.soql_builder_toggle }).click();
      const builderFrame = await webviewActiveFrame(page, hasContent('#main'));
      const runQuery = builderFrame.getByRole('button', { name: 'Run Query' });
      await expect(runQuery, 'SOQL Builder Run Query button should be visible').toBeVisible({ timeout: 15_000 });
      await runQuery.click();
      await expect(page.getByRole('tab', { name: messages.soql_query_results }), 'results tab should open').toBeVisible(
        {
          timeout: 30_000
        }
      );
    });

    let resultsFrame = await webviewActiveFrame(page, hasTitle(messages.soql_query_results));
    const firstAccountName = accountNames[0];
    const lastAccountName = accountNames.at(-1)!;
    const saveResults = async (extension: 'csv' | 'json'): Promise<void> => {
      await resultsFrame.getByRole('button', { name: `Save as ${extension.toUpperCase()}` }).click();
      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await quickInput.waitFor({ state: 'visible', timeout: 15_000 });
      await expect(quickInput.locator('input.input'), `save target should end in .${extension}`).toHaveValue(
        new RegExp(`\\.${extension}$`)
      );
      await quickInput.getByRole('button', { name: 'OK' }).click();
      await waitForNotification(page, new RegExp(`We saved the results as:.*\\.${extension}`), { timeout: 30_000 });
      await clearAllNotifications(page);
    };

    await test.step('render flat and relationship columns', async () => {
      await expect(
        resultsFrame.locator('.tabulator-col[tabulator-field="Id"]'),
        'Id column should render'
      ).toBeVisible();
      await expect(
        resultsFrame.locator('.tabulator-col[tabulator-field="Name"]'),
        'Name column should render'
      ).toBeVisible();
      await expect(
        resultsFrame.locator('.tabulator-col[tabulator-field="Owner.Name"]'),
        'Owner.Name relationship column should render'
      ).toBeVisible();
      await expect(
        resultsFrame.locator('.tabulator-cell[tabulator-field="Owner.Name"]').first(),
        'Owner.Name relationship cells should contain data'
      ).not.toBeEmpty();
      await expect(resultsFrame.locator('.tabulator-row'), 'first page should contain 50 records').toHaveCount(50);
      await expect(
        resultsFrame.getByText(firstAccountName, { exact: true }),
        'first page should show the first record'
      ).toBeVisible();
    });

    await test.step('paginate', async () => {
      await resultsFrame.getByRole('button', { name: 'Next Page' }).click();
      await expect(resultsFrame.locator('.tabulator-row'), 'second page should contain 5 records').toHaveCount(5);
      await expect(
        resultsFrame.getByText(lastAccountName, { exact: true }),
        'second page should show the last record'
      ).toBeVisible();
      await expect(
        resultsFrame.getByText(firstAccountName, { exact: true }),
        'first-page record should be hidden'
      ).not.toBeVisible();
    });

    await test.step('resize the results viewer', async () => {
      const table = resultsFrame.locator('#data-table');
      const initialBox = await table.boundingBox();
      expect(initialBox, 'results table should have a measurable size').not.toBeNull();
      await page.setViewportSize({ width: 1280, height: 720 });
      await expect
        .poll(async () => (await table.boundingBox())?.width, { message: 'results table should resize with VS Code' })
        .toBeLessThan(initialBox!.width);
      await expect(
        resultsFrame.getByText(lastAccountName, { exact: true }),
        'records should remain visible after resize'
      ).toBeVisible();
    });

    await test.step('save results as CSV', () => saveResults('csv'));

    await test.step('restore the selected page after switching editors', async () => {
      const csvFile = page
        .locator('[role="treeitem"]')
        .filter({ hasText: new RegExp(`${SOQL_FILE}\\.csv$`) })
        .first();
      await expect(csvFile, 'saved CSV should be revealed in the Explorer').toBeVisible({ timeout: 15_000 });
      await csvFile.dblclick();
      await expect(page.getByRole('tab', { name: `${SOQL_FILE}.csv` }), 'saved CSV should open').toBeVisible({
        timeout: 15_000
      });
      await page.getByRole('tab', { name: messages.soql_query_results }).click();
      resultsFrame = await webviewActiveFrame(page, hasTitle(messages.soql_query_results));
      await expect(
        resultsFrame.getByText(lastAccountName, { exact: true }),
        'the selected page should remain rendered after switching back'
      ).toBeVisible();
      await expect(
        resultsFrame.locator('.tabulator-row'),
        'the restored second page should contain 5 records'
      ).toHaveCount(5);
    });

    await test.step('save results as JSON', () => saveResults('json'));

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  } finally {
    if (connection && accountIds.length > 0) {
      const results = await connection.sobject('Account').destroy(accountIds);
      expect(
        results.filter(result => !result.success),
        'all pagination records should be deleted'
      ).toEqual([]);
    }
  }
});
