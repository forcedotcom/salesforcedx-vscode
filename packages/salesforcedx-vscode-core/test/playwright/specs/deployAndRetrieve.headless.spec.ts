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
  upsertSettings,
  editOpenFile,
  openFileByName,
  executeCommandWithCommandPalette,
  verifyCommandExists,
  executeEditorContextMenuCommand,
  executeExplorerContextMenuCommand,
  clearOutputChannel,
  waitForOutputChannelText,
  isMacDesktop,
  validateNoCriticalErrors,
  saveScreenshot
} from '@salesforce/playwright-vscode-ext';
import { COMMAND_TIMEOUT } from '../constants';
import { setupWorkbenchSettingsAndOutputChannel } from '../setupHelpers';
import { createApexClassCore } from '../coreHelpers';
import packageNls from '../../../package.nls.json';

test('Deploy and Retrieve: deploy and retrieve via command palette and context menus', async ({ page }) => {
  test.setTimeout(COMMAND_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const className = `DeployRetrieveTest${Date.now()}`;

  await test.step('setup: workbench, settings, create apex class', async () => {
    await setupWorkbenchSettingsAndOutputChannel(page);

    // Create the apex class under test
    await createApexClassCore(page, className);
    await saveScreenshot(page, 'setup.class-created.png');

    // Wait for extension to fully activate (context keys like sf:has_target_org)
    await verifyCommandExists(page, packageNls.deploy_this_source_text, 120_000);
  });

  await test.step('deploy via command palette (ST enabled)', async () => {
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);
    await waitForOutputChannelText(page, {
      expectedText: `Ended ${packageNls.deploy_this_source_text}`,
      timeout: COMMAND_TIMEOUT
    });
    await saveScreenshot(page, 'deploy-st.complete.png');
  });

  await test.step('deploy again with no changes (ST enabled)', async () => {
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);
    await waitForOutputChannelText(page, {
      expectedText: `Ended ${packageNls.deploy_this_source_text}`,
      timeout: COMMAND_TIMEOUT
    });
    await saveScreenshot(page, 'deploy-st-no-changes.complete.png');
  });

  await test.step('modify and deploy (ST enabled)', async () => {
    await clearOutputChannel(page);
    await editOpenFile(page, 'deploy modification');
    await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);
    await waitForOutputChannelText(page, {
      expectedText: `Ended ${packageNls.deploy_this_source_text}`,
      timeout: COMMAND_TIMEOUT
    });
    await saveScreenshot(page, 'deploy-st-modified.complete.png');
  });

  // Context menus don't work on Mac desktop
  if (!isMacDesktop()) {
    await test.step('deploy via editor context menu', async () => {
      await clearOutputChannel(page);
      await verifyCommandExists(page, packageNls.deploy_this_source_text, 120_000);
      await executeEditorContextMenuCommand(page, packageNls.deploy_this_source_text, `${className}.cls`);
      await waitForOutputChannelText(page, {
        expectedText: `Ended ${packageNls.deploy_this_source_text}`,
        timeout: COMMAND_TIMEOUT
      });
      await saveScreenshot(page, 'deploy-editor-context.complete.png');
    });

    await test.step('deploy via explorer context menu', async () => {
      await clearOutputChannel(page);
      await executeExplorerContextMenuCommand(
        page,
        new RegExp(`${className}\\.cls`),
        packageNls.deploy_this_source_text
      );
      await waitForOutputChannelText(page, {
        expectedText: `Ended ${packageNls.deploy_this_source_text}`,
        timeout: COMMAND_TIMEOUT
      });
      await saveScreenshot(page, 'deploy-explorer-context.complete.png');
    });
  }

  await test.step('retrieve via command palette', async () => {
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.retrieve_this_source_text);
    await waitForOutputChannelText(page, {
      expectedText: `Ended ${packageNls.retrieve_this_source_text}`,
      timeout: COMMAND_TIMEOUT
    });
    await saveScreenshot(page, 'retrieve.complete.png');
  });

  await test.step('modify file, retrieve, verify content reverts', async () => {
    // Edit the file with a unique marker comment
    await editOpenFile(page, 'WILL_BE_REVERTED');
    await saveScreenshot(page, 'retrieve-revert.after-edit.png');

    // Retrieve should overwrite local with org version (without the marker)
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.retrieve_this_source_text);
    await waitForOutputChannelText(page, {
      expectedText: `Ended ${packageNls.retrieve_this_source_text}`,
      timeout: COMMAND_TIMEOUT
    });

    // Verify the marker comment is gone from the editor
    const editor = page.locator(`[data-uri*="${className}.cls"] .view-lines`).first();
    await expect(editor).toBeVisible({ timeout: 10_000 });
    const editorText = await editor.textContent();
    expect(editorText, 'File should not contain the edit marker after retrieve').not.toContain('WILL_BE_REVERTED');
    await saveScreenshot(page, 'retrieve-revert.complete.png');
  });

  if (!isMacDesktop()) {
    await test.step('retrieve via editor context menu', async () => {
      await clearOutputChannel(page);
      // make sure the command is available, ie, context has been set after the last retrieve
      await verifyCommandExists(page, packageNls.retrieve_this_source_text, 120_000);
      await executeEditorContextMenuCommand(page, packageNls.retrieve_this_source_text, `${className}.cls`);
      await waitForOutputChannelText(page, {
        expectedText: `Ended ${packageNls.retrieve_this_source_text}`,
        timeout: COMMAND_TIMEOUT
      });
      await saveScreenshot(page, 'retrieve-editor-context.complete.png');
    });

    await test.step('retrieve via explorer context menu', async () => {
      await clearOutputChannel(page);
      await executeExplorerContextMenuCommand(
        page,
        new RegExp(`${className}\\.cls`),
        packageNls.retrieve_this_source_text
      );
      await waitForOutputChannelText(page, {
        expectedText: `Ended ${packageNls.retrieve_this_source_text}`,
        timeout: COMMAND_TIMEOUT
      });
      await saveScreenshot(page, 'retrieve-explorer-context.complete.png');
    });
  }

  await test.step('disable ST and deploy', async () => {
    await upsertSettings(page, {
      'salesforcedx-vscode-core.experimental.enableSourceTrackingForDeployAndRetrieve': 'false'
    });
    // Ensure apex class file is open (command requires active editor)
    await openFileByName(page, `${className}.cls`);
    // Wait for command to be available after setting change
    await verifyCommandExists(page, packageNls.deploy_this_source_text, 120_000);
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);
    await waitForOutputChannelText(page, {
      expectedText: `Ended ${packageNls.deploy_this_source_text}`,
      timeout: COMMAND_TIMEOUT
    });
    await saveScreenshot(page, 'deploy-no-st.complete.png');
  });

  await validateNoCriticalErrors(test, consoleErrors);
});
