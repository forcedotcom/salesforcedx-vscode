/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { test } from '../fixtures';
import { expect } from '@playwright/test';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  filterErrors,
  filterNetworkErrors,
  waitForVSCodeWorkbench
} from '../utils/helpers';
import { OrgBrowserPage } from '../pages/orgBrowserPage';
import { create } from '../utils/dreamhouseScratchOrgSetup';
import { upsertScratchOrgAuthFieldsToSettings } from '../pages/settings';

test.describe('Org Browser headless smoke', () => {
  test.beforeEach(async ({ page }) => {
    const createResult = await create();
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
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
