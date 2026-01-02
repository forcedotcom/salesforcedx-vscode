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
  upsertScratchOrgAuthFieldsToSettings,
  closeWelcomeTabs,
  ensureOutputPanelOpen,
  selectOutputChannel,
  waitForOutputChannelText,
  outputChannelContains,
  createMinimalOrg,
  validateNoCriticalErrors,
  TAB
} from '@salesforce/playwright-vscode-ext';
import { upsertRetrieveOnLoadSetting } from '../pages/settingsPage';
import { SERVICES_CHANNEL_NAME } from '../../../src/constants';

test('retrieves metadata on load for CustomObject:Activity and Workflow:Case', async ({ page }) => {
  test.setTimeout(10 * 60 * 1000); // 10 minutes for org creation and metadata retrieval

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup org auth and configure retrieveOnLoad setting', async () => {
    const orgAuth = await createMinimalOrg();
    await upsertScratchOrgAuthFieldsToSettings(page, orgAuth);

    // Set the retrieveOnLoad setting
    await upsertRetrieveOnLoadSetting(page, 'CustomObject:Activity, Workflow:Case');

    await closeWelcomeTabs(page);
  });

  await test.step('verify output channel shows retrieval message', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, SERVICES_CHANNEL_NAME);

    await waitForOutputChannelText(page, { expectedText: 'Retrieving metadata on load', timeout: 60_000 });

    const hasCustomObject = await outputChannelContains(page, 'CustomObject:Activity');
    const hasWorkflow = await outputChannelContains(page, 'Workflow:Case');

    expect(hasCustomObject, 'Should show CustomObject:Activity in retrieval message').toBe(true);
    expect(hasWorkflow, 'Should show Workflow:Case in retrieval message').toBe(true);
  });

  await test.step('verify success message in output channel', async () => {
    await waitForOutputChannelText(page, { expectedText: 'Retrieve on load completed', timeout: 300_000 });
    const hasFileCount = await outputChannelContains(page, 'files retrieved successfully');
    expect(hasFileCount, 'Should show file count in success message').toBe(true);
  });

  await test.step('verify editor tabs contain retrieved files', async () => {
    const tabs = page.locator(TAB);
    const tabTexts = await tabs.allTextContents();

    // Should have at least 1 file open (Activity object and/or Case workflow)
    expect(tabTexts.length, `Should have opened files, got: ${tabTexts.join(', ')}`).toBeGreaterThanOrEqual(1);

    // Check that we have files related to our metadata
    const hasActivityOrCase = tabTexts.some(
      text => text.toLowerCase().includes('activity') || text.toLowerCase().includes('case')
    );
    expect(hasActivityOrCase, `Expected Activity or Case related files, got: ${tabTexts.join(', ')}`).toBe(true);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
