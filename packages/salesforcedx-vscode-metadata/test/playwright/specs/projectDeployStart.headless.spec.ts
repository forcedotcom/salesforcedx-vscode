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
  createApexClass,
  executeCommandWithCommandPalette,
  saveScreenshot,
  validateNoCriticalErrors,
  ensureOutputPanelOpen,
  selectOutputChannel,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import packageNls from '../../../package.nls.json';

test('Project Deploy Start: deploys source to org', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let statusBarPage: SourceTrackingStatusBarPage;
  let className: string;

  await test.step('setup dreamhouse org', async () => {
    const createResult = await createDreamhouseOrg();
    await waitForVSCodeWorkbench(page);
    await saveScreenshot(page, 'setup.after-workbench.png');
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    await saveScreenshot(page, 'setup.after-auth-fields.png');

    statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);
    await saveScreenshot(page, 'setup.after-status-bar-visible.png');

    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
    await saveScreenshot(page, 'setup.complete.png');
  });

  await test.step('create local change and deploy to org', async () => {
    // Create a new Apex class to deploy
    className = `ProjectDeployTest${Date.now()}`;
    await createApexClass(page, className);
    await saveScreenshot(page, 'step1.after-create-class.png');

    // Get initial counts
    const initialCounts = await statusBarPage.getCounts();
    await saveScreenshot(page, `step1.initial-counts-${initialCounts.local}-${initialCounts.remote}-${initialCounts.conflicts}.png`);

    // Prepare output channel before triggering command
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');

    // Execute deploy via command palette
    await executeCommandWithCommandPalette(page, packageNls.project_deploy_start_default_org_text);
    await saveScreenshot(page, 'step1.after-command-palette.png');

    // Verify deploy starts and completes via output channel
    // Source tracking counts may not update reliably in web mode, so use output verification
    await waitForOutputChannelText(page, { expectedText: 'Deploying', timeout: 30_000 });
    await saveScreenshot(page, 'step1.deploy-started.png');

    await waitForOutputChannelText(page, { expectedText: 'deployed', timeout: 240_000 });
    await saveScreenshot(page, 'step1.deploy-complete.png');

    // Deploy operation completed successfully (verified via output channel)
    await saveScreenshot(page, 'step1.final-state.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
