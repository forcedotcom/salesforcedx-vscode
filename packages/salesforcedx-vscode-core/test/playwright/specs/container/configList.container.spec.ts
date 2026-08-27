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
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { containerTest as test } from '../../fixtures/containerFixtures';
import packageNls from '../../../../package.nls.json';
import { messages } from '../../../../src/messages/i18n';

const CORE_CHANNEL = 'Salesforce CLI';

/*
 * Seed spec proving the Code Builder container pipeline end-to-end: command palette → CLI
 * shell-out → output channel. Org comes from the container's CLI default (SF_ACCESS_TOKEN auth at
 * container start), not a workspace .sf/config.json — so this asserts the config table header
 * rather than a specific target-org value.
 */
test('Config List (Code Builder): lists config variables in output channel', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('wait for workbench', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    // First container boot stacks telemetry/what's-new toasts that can cover the output toolbar.
    await clearAllNotifications(page);
    await saveScreenshot(page, 'configList.container.01-ready.png');
  });

  await test.step('verify command exists and run it', async () => {
    await verifyCommandExists(page, packageNls.config_list_text, 30_000);
    await executeCommandWithCommandPalette(page, packageNls.config_list_text);
  });

  await test.step('verify output channel shows config table', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, CORE_CHANNEL, 30_000);
    // First CLI shell-out in a cold container pays sf startup + telemetry init, so the channel can
    // stay empty for several seconds after the command fires. Match the CLI-command budget other
    // shell-out specs use (30s) rather than the 10s that fits an already-warm CLI.
    await waitForOutputChannelText(page, { expectedText: messages.config_list_column_location, timeout: 30_000 });
    await saveScreenshot(page, 'configList.container.02-output-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
