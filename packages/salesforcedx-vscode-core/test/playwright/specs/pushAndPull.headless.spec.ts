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
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createMinimalOrg,
  upsertScratchOrgAuthFieldsToSettings,
  upsertSettings,
  editOpenFile,
  executeCommandWithCommandPalette,
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  outputChannelContains,
  validateNoCriticalErrors,
  saveScreenshot,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import { COMMAND_TIMEOUT, OUTPUT_CHANNEL } from '../constants';
import { createApexClassCore } from '../coreHelpers';

test('Push and Pull: push, pull, and view changes', async ({ page }) => {
  test.setTimeout(COMMAND_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const className = `PushPullTest${Date.now()}`;

  await test.step('setup: workbench, settings, output channel', async () => {
    const createResult = await createMinimalOrg();
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    await verifyCommandExists(page, 'SFDX: View Local Changes', 120_000);

    await upsertSettings(page, { 'salesforcedx-vscode-core.useMetadataExtensionCommands': 'false' });

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, OUTPUT_CHANNEL, 120_000);
    await saveScreenshot(page, 'setup.complete.png');
  });

  await test.step('view local changes (empty)', async () => {
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, 'SFDX: View Local Changes');
    await waitForOutputChannelText(page, {
      expectedText: 'Source Status',
      timeout: COMMAND_TIMEOUT
    });
    const hasNoLocalChanges = await outputChannelContains(page, 'No local or remote changes found');
    expect(hasNoLocalChanges, 'View Local Changes should show no local changes').toBe(true);
    await saveScreenshot(page, 'view-local-empty.complete.png');
  });

  await test.step('create apex class', async () => {
    await createApexClassCore(page, className);
    await saveScreenshot(page, 'class-created.png');
  });

  await test.step('view local changes shows new class', async () => {
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, 'SFDX: View Local Changes');
    await waitForOutputChannelText(page, { expectedText: className, timeout: COMMAND_TIMEOUT });

    const hasLocalAdd = await outputChannelContains(page, `Local Add  ${className}  ApexClass`);
    expect(hasLocalAdd, `View Local Changes should show "${className}" as Local Add`).toBe(true);
    await saveScreenshot(page, 'view-local.complete.png');
  });

  await test.step('push source to org', async () => {
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, 'SFDX: Push Source to Default Org');
    await waitForOutputChannelText(page, {
      expectedText: 'Ended SFDX: Push Source to Default Org',
      timeout: COMMAND_TIMEOUT
    });

    const hasCreated = await outputChannelContains(page, `Created  ${className}  ApexClass`);
    expect(hasCreated, `Push output should show "${className}" as Created`).toBe(true);
    await saveScreenshot(page, 'push.complete.png');
  });

  await test.step('push again with no changes', async () => {
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, 'SFDX: Push Source to Default Org');
    await waitForOutputChannelText(page, {
      expectedText: 'Ended SFDX: Push Source to Default Org',
      timeout: COMMAND_TIMEOUT
    });

    const hasNoResults = await outputChannelContains(page, 'No results found');
    expect(hasNoResults, 'Push with no changes should show "No results found"').toBe(true);
    await saveScreenshot(page, 'push-no-changes.complete.png');
  });

  await test.step('modify and push', async () => {
    await editOpenFile(page, 'push modification');
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, 'SFDX: Push Source to Default Org');
    await waitForOutputChannelText(page, {
      expectedText: 'Ended SFDX: Push Source to Default Org',
      timeout: COMMAND_TIMEOUT
    });

    const hasChanged = await outputChannelContains(page, `Changed  ${className}  ApexClass`);
    expect(hasChanged, `Push output should show "${className}" as Changed`).toBe(true);
    await saveScreenshot(page, 'push-modified.complete.png');
  });

  await test.step('pull source from org', async () => {
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, 'SFDX: Pull Source from Default Org');
    await waitForOutputChannelText(page, {
      expectedText: 'Ended SFDX: Pull Source from Default Org',
      timeout: COMMAND_TIMEOUT
    });
    // First pull typically gets Admin.profile
    await saveScreenshot(page, 'pull.complete.png');
  });

  await test.step('pull again with no changes', async () => {
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, 'SFDX: Pull Source from Default Org');
    await waitForOutputChannelText(page, {
      expectedText: 'Ended SFDX: Pull Source from Default Org',
      timeout: COMMAND_TIMEOUT
    });

    const hasNoResults = await outputChannelContains(page, 'No results found');
    expect(hasNoResults, 'Pull with no changes should show "No results found"').toBe(true);
    await saveScreenshot(page, 'pull-no-changes.complete.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
