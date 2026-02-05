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
  waitForVSCodeWorkbench,
  assertWelcomeTabExists,
  closeWelcomeTabs,
  createMinimalOrg,
  upsertScratchOrgAuthFieldsToSettings,
  createApexClass,
  verifyCommandExists,
  verifyCommandDoesNotExist,
  saveScreenshot,
  validateNoCriticalErrors,
  EDITOR_WITH_URI,
  executeCommandWithCommandPalette
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import packageNls from '../../../package.nls.json';

// Commands that depend on sf:in_package_directories context
const COMMANDS_TO_TEST = [
  packageNls.deploy_this_source_text,
  packageNls.retrieve_this_source_text,
  packageNls.delete_source_text,
  packageNls.diff_source_against_org_text
];

test('EditorWatcher: deploy commands show/hide based on active editor location', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let className: string;
  let statusBarPage: SourceTrackingStatusBarPage;

  await test.step('setup minimal org and wait for extensions to load', async () => {
    const createResult = await createMinimalOrg();
    await waitForVSCodeWorkbench(page);
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);

    await upsertScratchOrgAuthFieldsToSettings(page, createResult);

    statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);
  });

  await test.step('create apex class', async () => {
    className = `EditorWatcherTest${Date.now()}`;
    await createApexClass(page, className);
  });

  await test.step('verify apex class is active editor', async () => {
    const editor = page.locator(EDITOR_WITH_URI).first();
    await expect(editor).toBeVisible();
    await expect(editor).toHaveAttribute('data-uri', new RegExp(`${className}\\.cls`));
  });

  await test.step('verify deploy/retrieve commands are in command palette', async () => {
    // Use retry pattern to allow VS Code rendering and context updates
    for (const commandText of COMMANDS_TO_TEST) {
      await verifyCommandExists(page, commandText);
    }
    await saveScreenshot(page, 'step3.command-palette-has-commands.png');
  });

  await test.step('open sfdx-project.json (not in package directory)', async () => {
    // Focus explorer and click on sfdx-project.json to open it
    await executeCommandWithCommandPalette(page, 'File: Focus on Files Explorer');

    // Find and click the sfdx-project.json file in the explorer tree
    const projectFile = page.getByRole('treeitem', { name: /sfdx-project\.json/ });
    await projectFile.waitFor({ state: 'visible', timeout: 10_000 });
    await projectFile.dblclick();

    // Verify it's the active editor
    const editor = page.locator(EDITOR_WITH_URI).first();
    await expect(editor).toHaveAttribute('data-uri', /sfdx-project\.json/);
  });

  await test.step('assert deploy/retrieve commands not in command palette', async () => {
    // Use retry pattern to allow VS Code rendering and context updates
    for (const commandText of COMMANDS_TO_TEST) {
      await verifyCommandDoesNotExist(page, commandText);
    }
    await saveScreenshot(page, 'step6.command-palette-no-commands.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
