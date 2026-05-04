/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
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
import { desktopTest as test } from '../fixtures/desktopFixtures';
import packageNls from '../../../package.nls.json';
import { messages } from '../../../src/messages/i18n';

const CORE_CHANNEL = 'Salesforce CLI';

test('Config List: lists config variables in output channel', async ({ page }) => {
  test.setTimeout(60_000);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('wait for workbench', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
    await saveScreenshot(page, 'configList.01-ready.png');
  });

  await test.step('verify command exists and run it', async () => {
    await verifyCommandExists(page, packageNls.config_list_text, 30_000);
    await executeCommandWithCommandPalette(page, packageNls.config_list_text);
  });

  await test.step('verify output channel shows config table with target-org', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, CORE_CHANNEL, 10_000);
    // desktopTest fixture writes target-org to .sf/config.json before VS Code launches
    await waitForOutputChannelText(page, { expectedText: 'target-org', timeout: 5000 });
    await waitForOutputChannelText(page, { expectedText: messages.config_list_column_location, timeout: 5000 });
    await saveScreenshot(page, 'configList.02-output-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
