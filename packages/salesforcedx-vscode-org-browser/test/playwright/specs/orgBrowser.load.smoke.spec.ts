/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { test } from '../fixtures';
import { expect } from '@playwright/test';
import {
  filterErrors,
  filterNetworkErrors,
  waitForVSCodeWorkbench,
  create,
  upsertScratchOrgAuthFieldsToSettings,
  setupConsoleMonitoring,
  setupNetworkMonitoring
} from '@salesforce/playwright-vscode-ext';
import { OrgBrowserPage } from '../pages/orgBrowserPage';

test.describe('Org Browser headless smoke', () => {
  test.beforeEach(async ({ page }) => {
    const createResult = await create();
    const orgBrowserPage = new OrgBrowserPage(page);
    await upsertScratchOrgAuthFieldsToSettings(page, createResult, () => orgBrowserPage.waitForProject());
  });

  test('loads VS Code web and opens Org Browser activity', async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    await waitForVSCodeWorkbench(page);

    // Use the shared Page Object
    const orgBrowserPage = new OrgBrowserPage(page);

    await orgBrowserPage.waitForProject();
    await orgBrowserPage.openOrgBrowser();

    // Validate no critical errors
    const criticalConsole = filterErrors(consoleErrors);
    const criticalNetwork = filterNetworkErrors(networkErrors);

    expect(criticalConsole, `Console errors: ${criticalConsole.map(e => e.text).join(' | ')}`).toHaveLength(0);
    expect(criticalNetwork, `Network errors: ${criticalNetwork.map(e => e.description).join(' | ')}`).toHaveLength(0);
  });
});
