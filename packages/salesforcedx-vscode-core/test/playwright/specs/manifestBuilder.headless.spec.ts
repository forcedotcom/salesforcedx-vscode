/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { test } from '../fixtures';
import {
  setupConsoleMonitoring,
  openFileByName,
  executeCommandWithCommandPalette,
  executeExplorerContextMenuCommand,
  clearOutputChannel,
  waitForOutputChannelText,
  isMacDesktop,
  validateNoCriticalErrors,
  saveScreenshot,
  EDITOR,
  QUICK_INPUT_WIDGET
} from '@salesforce/playwright-vscode-ext';
import { COMMAND_TIMEOUT } from '../constants';
import { setupWorkbenchSettingsAndOutputChannel } from '../setupHelpers';
import { createApexClassCore } from '../coreHelpers';
import packageNls from '../../../package.nls.json';

const MANIFEST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>*</members>
    <name>ApexClass</name>
  </types>
  <version>64.0</version>
</Package>`;

test('Manifest Builder: generate manifest, deploy and retrieve via manifest', async ({ page, workspaceDir }) => {
  test.setTimeout(COMMAND_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('setup: workbench, settings, create apex class', async () => {
    await setupWorkbenchSettingsAndOutputChannel(page);

    // Create an apex class to include in the manifest
    await createApexClassCore(page, `ManifestTest${Date.now()}`);
    await saveScreenshot(page, 'setup.class-created.png');
  });

  await test.step('generate manifest file', async step => {
    step.skip(isMacDesktop(), 'Explorer context menu not available on Mac Desktop');
    // Command is only available via explorer context menu, not command palette
    await executeExplorerContextMenuCommand(page, /classes/i, packageNls.project_generate_manifest);

    // Wait for filename prompt and accept default
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await saveScreenshot(page, 'manifest.prompt-visible.png');
    await page.keyboard.press('Enter');

    // Wait for manifest file to open in editor
    const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/package.xml"]`).first();
    await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'manifest.file-opened.png');
  });

  await test.step('create manifest file via fs (Mac only)', async step => {
    step.skip(!isMacDesktop(), 'Only run on Mac Desktop');
    await fs.mkdir(path.join(workspaceDir, 'manifest'), { recursive: true });
    await fs.writeFile(path.join(workspaceDir, 'manifest', 'package.xml'), MANIFEST_XML);
    await openFileByName(page, 'package.xml');
  });

  await test.step('deploy source in manifest', async () => {
    // Ensure manifest file is the active editor
    await openFileByName(page, 'package.xml');
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, packageNls.deploy_in_manifest_text);
    await waitForOutputChannelText(page, {
      expectedText: 'Deployed Source',
      timeout: COMMAND_TIMEOUT
    });
    await saveScreenshot(page, 'manifest-deploy.complete.png');
  });

  await test.step('retrieve source in manifest', async () => {
    await openFileByName(page, 'package.xml');
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, packageNls.retrieve_in_manifest_text);
    await waitForOutputChannelText(page, {
      expectedText: 'Retrieved Source',
      timeout: COMMAND_TIMEOUT
    });
    await saveScreenshot(page, 'manifest-retrieve.complete.png');
  });

  await test.step('generate manifest file (not mac)', async step => {
    step.skip(isMacDesktop(), 'Explorer context menu not available on Mac Desktop');
    // Command is only available via explorer context menu, not command palette
    await executeExplorerContextMenuCommand(page, /classes/i, 'SFDX: Generate Manifest File');

    // Wait for filename prompt and accept default
    const quickInput = page.locator(QUICK_INPUT_WIDGET);
    await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
    await saveScreenshot(page, 'manifest.prompt-visible.png');
    await page.keyboard.press('Enter');

    // Wait for manifest file to open in editor
    const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/package.xml"]`).first();
    await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'manifest.file-opened.png');
  });

  await test.step('create manifest file via fs (Mac only)', async step => {
    step.skip(!isMacDesktop(), 'Only run on Mac Desktop');
    await fs.mkdir(path.join(workspaceDir, 'manifest'), { recursive: true });
    await fs.writeFile(path.join(workspaceDir, 'manifest', 'package.xml'), MANIFEST_XML);
    await openFileByName(page, 'package.xml');
  });

  await test.step('deploy source in manifest', async () => {
    // Ensure manifest file is the active editor
    await openFileByName(page, 'package.xml');
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, 'SFDX: Deploy Source in Manifest to Org');
    await waitForOutputChannelText(page, {
      expectedText: 'Deployed Source',
      timeout: COMMAND_TIMEOUT
    });
    await saveScreenshot(page, 'manifest-deploy.complete.png');
  });

  await test.step('retrieve source in manifest', async () => {
    await openFileByName(page, 'package.xml');
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, 'SFDX: Retrieve Source in Manifest from Org');
    await waitForOutputChannelText(page, {
      expectedText: 'Retrieved Source',
      timeout: COMMAND_TIMEOUT
    });
    await saveScreenshot(page, 'manifest-retrieve.complete.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
