/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test } from '../fixtures';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  assertWelcomeTabExists,
  closeWelcomeTabs,
  createDreamhouseOrg,
  upsertScratchOrgAuthFieldsToSettings,
  executeCommandWithCommandPalette,
  saveScreenshot,
  validateNoCriticalErrors,
  ensureOutputPanelOpen,
  selectOutputChannel,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import packageNls from '../../../package.nls.json';

test('Project Retrieve Start: retrieves source from org', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let statusBarPage: SourceTrackingStatusBarPage;

  await test.step('setup dreamhouse org', async () => {
    const createResult = await createDreamhouseOrg();
    await waitForVSCodeWorkbench(page);
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
    await saveScreenshot(page, 'setup.after-workbench.png');
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    await saveScreenshot(page, 'setup.after-auth-fields.png');

    statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);
    await saveScreenshot(page, 'setup.after-status-bar-visible.png');
    await saveScreenshot(page, 'setup.complete.png');
  });

  await test.step('retrieve source from org', async () => {
    // Get initial counts
    const initialCounts = await statusBarPage.getCounts();
    await saveScreenshot(
      page,
      `step1.initial-counts-${initialCounts.local}-${initialCounts.remote}-${initialCounts.conflicts}.png`
    );

    // Prepare output channel before triggering command
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');

    // Execute retrieve via command palette
    await executeCommandWithCommandPalette(page, packageNls.project_retrieve_start_default_org_text);
    await saveScreenshot(page, 'step1.after-command-palette.png');

    // Verify retrieve starts and completes via output channel
    // Source tracking counts may not update reliably in web mode, so use output verification
    await waitForOutputChannelText(page, { expectedText: 'Retrieving', timeout: 30_000 });
    await saveScreenshot(page, 'step1.retrieve-started.png');

    await waitForOutputChannelText(page, { expectedText: 'retrieved', timeout: 240_000 });
    await saveScreenshot(page, 'step1.retrieve-complete.png');

    // Retrieve operation completed successfully (verified via output channel)
    await saveScreenshot(page, 'step1.final-state.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
