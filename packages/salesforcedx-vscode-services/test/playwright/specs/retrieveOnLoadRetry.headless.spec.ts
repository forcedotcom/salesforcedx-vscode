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
  assertWelcomeTabExists,
  closeWelcomeTabs,
  ensureOutputPanelOpen,
  selectOutputChannel,
  waitForOutputChannelText,
  outputChannelContains,
  createMinimalOrg,
  validateNoCriticalErrors,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { upsertRetrieveOnLoadSetting } from '../pages/settingsPage';
import { SERVICES_CHANNEL_NAME } from '../../../src/constants';

test.beforeEach(async ({ page }) => {
  await waitForVSCodeWorkbench(page);
  await assertWelcomeTabExists(page);
  await closeWelcomeTabs(page);
});

test('handles project resolution with retry logic', async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup org auth and configure retrieveOnLoad setting', async () => {
    const orgAuth = await createMinimalOrg();
    await upsertScratchOrgAuthFieldsToSettings(page, orgAuth);
    await upsertRetrieveOnLoadSetting(page, 'CustomObject:Account');
  });

  await test.step('verify project resolution succeeds', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, SERVICES_CHANNEL_NAME);

    // Should not see project resolution failure message
    await waitForOutputChannelText(page, { expectedText: 'Retrieving metadata on load', timeout: 90_000 });

    const hasProjectFailure = await outputChannelContains(page, 'Project resolution failed');
    expect(hasProjectFailure, 'Should not fail project resolution with retry logic').toBe(false);
  });

  await test.step('verify retrieval completes successfully', async () => {
    await waitForOutputChannelText(page, { expectedText: 'Retrieve on load completed', timeout: 300_000 });
    const hasFileCount = await outputChannelContains(page, 'files retrieved successfully');
    expect(hasFileCount, 'Should show file count in success message').toBe(true);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
