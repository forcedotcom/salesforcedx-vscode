/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  clearAllNotifications,
  closeWelcomeTabs,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';
import { isContainer, test } from '../fixtures';
import packageNls from '../../../package.nls.json';
import { messages } from '../../../src/messages/i18n';

const CORE_CHANNEL = 'Salesforce CLI';

test('Config List: lists config variables in output channel', async ({ page }) => {
  test.setTimeout(60_000);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('wait for workbench', async () => {
    // No-op once ready (container's fixture already awaited it); the real wait on desktop.
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    if (isContainer) {
      // First container boot stacks telemetry/what's-new toasts that can cover the output toolbar.
      await clearAllNotifications(page);
    } else {
      await waitForWorkspaceReady(page);
    }
    await saveScreenshot(page, 'configList.01-ready.png');
  });

  await test.step('verify command exists and run it', async () => {
    await verifyCommandExists(page, packageNls.config_list_text, 30_000);
    await executeCommandWithCommandPalette(page, packageNls.config_list_text);
  });

  await test.step('verify output channel shows config table', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, CORE_CHANNEL, isContainer ? 30_000 : 10_000);
    if (!isContainer) {
      // desktopTest fixture writes target-org to .sf/config.json before VS Code launches. The
      // container's org comes from the CLI default (SF_ACCESS_TOKEN auth at container start), not a
      // workspace .sf/config.json, so it only asserts the config table header below.
      await waitForOutputChannelText(page, { expectedText: 'target-org', timeout: 5000 });
    }
    // First CLI shell-out in a cold container pays sf startup + telemetry init, so the channel can
    // stay empty for several seconds after the command fires — match the CLI-command budget other
    // shell-out specs use (30s) rather than the 5s that fits an already-warm desktop CLI.
    await waitForOutputChannelText(page, {
      expectedText: messages.config_list_column_location,
      timeout: isContainer ? 30_000 : 5000
    });
    await saveScreenshot(page, 'configList.02-output-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
