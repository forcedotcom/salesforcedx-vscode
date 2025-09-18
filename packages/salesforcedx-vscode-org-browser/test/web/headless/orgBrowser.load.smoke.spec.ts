/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { test, expect } from '@playwright/test';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  filterErrors,
  filterNetworkErrors,
  waitForVSCodeWorkbench
} from '../utils/headless-helpers';
import { OrgBrowserPage } from '../pages/orgBrowserPage';
import { create } from '../utils/dreamhouseScratchOrgSetup';
import { upsertScratchOrgAuthFieldsToSettings } from '../pages/Settings';

test.describe('Org Browser headless smoke', () => {
  test.beforeEach(async ({ browser, page }) => {
    const createResult = await create();
    const { accessToken, instanceUrl, instanceApiVersion } = createResult;
    const authFields = { accessToken, instanceUrl, instanceApiVersion };
    await upsertScratchOrgAuthFieldsToSettings(page, authFields);
  });

  test('loads VS Code web and opens Org Browser activity', async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    await waitForVSCodeWorkbench(page);

    // Use the shared Page Object
    const orgBrowserPage = new OrgBrowserPage(page);
    if (process.env.DEBUG_MODE) {
      await page.pause();
    }
    await orgBrowserPage.waitForProject();
    await orgBrowserPage.openOrgBrowser();

    // Validate no critical errors
    const criticalConsole = filterErrors(consoleErrors);
    const criticalNetwork = filterNetworkErrors(networkErrors);

    expect(criticalConsole, `Console errors: ${criticalConsole.map(e => e.text).join(' | ')}`).toHaveLength(0);
    expect(criticalNetwork, `Network errors: ${criticalNetwork.map(e => e.description).join(' | ')}`).toHaveLength(0);

    if (process.env.DEBUG_MODE) {
      // Keep the browser open for manual poking around in debug mode
      await page.pause();
    }
  });
});
