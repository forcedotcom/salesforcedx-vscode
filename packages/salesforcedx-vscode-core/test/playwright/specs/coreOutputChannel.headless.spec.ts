/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  countOutputChannelOptions,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForOutputChannelText,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';
import { desktopTest as test } from '../fixtures/desktopFixtures';
import { messages } from '../../../src/messages/i18n';

const CORE_CHANNEL = 'Salesforce CLI';

test("Core output channel: single 'Salesforce CLI' channel, wired to services layer", async ({ page }) => {
  test.setTimeout(60_000);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('wait for workbench', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
    await saveScreenshot(page, 'coreOutputChannel.01-ready.png');
  });

  await test.step('metadataXmlSupport wrote to the services-owned channel via getCoreChannelService', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, CORE_CHANNEL, 10_000);
    // Core harness installs no redhat.vscode-xml, so initializeMetadataSupport hits the no-redhat
    // branch and writes this via the legacy wrapper backed by the single services channel.
    await waitForOutputChannelText(page, { expectedText: messages.metadata_xml_no_redhat_extension_found });
    await saveScreenshot(page, 'coreOutputChannel.02-text-verified.png');
  });

  await test.step('exactly one Salesforce CLI channel exists (dedupe guard)', async () => {
    const count = await countOutputChannelOptions(page, CORE_CHANNEL);
    expect(count, `expected exactly one '${CORE_CHANNEL}' output channel`).toBe(1);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
