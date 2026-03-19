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
  createApexClass,
  editOpenFile,
  openFileByName,
  executeCommandWithCommandPalette,
  clearOutputChannel,
  waitForOutputChannelText,
  validateNoCriticalErrors,
  saveScreenshot,
  EDITOR_WITH_URI
} from '@salesforce/playwright-vscode-ext';
import { COMMAND_TIMEOUT } from '../constants';
import { setupWorkbenchSettingsAndOutputChannel } from '../setupHelpers';
import packageNls from '../../../package.nls.json';

test('Metadata Deploy Retrieve: deploy v1, deploy v2, retrieve matches v2', async ({ page }) => {
  test.setTimeout(COMMAND_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const className = `MdDRTest${Date.now()}`;

  let textV1: string;
  let textV2: string;

  const getEditorText = async (): Promise<string> => {
    const editor = page.locator(EDITOR_WITH_URI).first();
    await editor.waitFor({ state: 'visible', timeout: 10_000 });
    const viewLines = editor.locator('.view-lines').first();
    const text = await viewLines.textContent();
    return (text ?? '').replaceAll('\u00A0', ' ');
  };

  await test.step('setup: workbench, settings, output channel', async () => {
    await setupWorkbenchSettingsAndOutputChannel(page);
  });

  await test.step('create and deploy v1', async () => {
    await createApexClass(page, className);
    textV1 = await getEditorText();
    await saveScreenshot(page, 'v1.after-create.png');

    await clearOutputChannel(page);
    await openFileByName(page, `${className}.cls`);
    await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);
    await waitForOutputChannelText(page, {
      expectedText: `Ended ${packageNls.deploy_this_source_text}`,
      timeout: COMMAND_TIMEOUT
    });
    await saveScreenshot(page, 'v1.deploy-complete.png');
  });

  await test.step('modify and deploy v2', async () => {
    await editOpenFile(page, 'v2 modification comment');
    textV2 = await getEditorText();
    expect(textV2, 'v2 text should differ from v1').not.toBe(textV1);
    await saveScreenshot(page, 'v2.after-edit.png');

    await clearOutputChannel(page);
    await openFileByName(page, `${className}.cls`);
    await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);
    await waitForOutputChannelText(page, {
      expectedText: `Ended ${packageNls.deploy_this_source_text}`,
      timeout: COMMAND_TIMEOUT
    });
    await saveScreenshot(page, 'v2.deploy-complete.png');
  });

  await test.step('retrieve v2 and verify unchanged', async () => {
    await clearOutputChannel(page);
    await openFileByName(page, `${className}.cls`);
    await executeCommandWithCommandPalette(page, packageNls.retrieve_this_source_text);
    await waitForOutputChannelText(page, {
      expectedText: `Ended ${packageNls.retrieve_this_source_text}`,
      timeout: COMMAND_TIMEOUT
    });

    const textAfterRetrieve = await getEditorText();
    // Retrieve overwrites local with org version which IS v2
    expect(textAfterRetrieve, 'Retrieved text should contain v2 modification').toContain('v2 modification comment');
    await saveScreenshot(page, 'retrieve-v2.complete.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
