/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  clearAllNotifications,
  closeWelcomeTabs,
  countOutputChannelOptions,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { expect } from '@playwright/test';
import { containerTest as test } from '../../fixtures/containerFixtures';
import { messages } from '../../../../src/messages/i18n';

const CORE_CHANNEL = 'Salesforce CLI';

/*
 * Container twin of coreOutputChannel.headless: proves the Code Builder container wires a single
 * services-owned 'Salesforce CLI' output channel. The container harness installs no
 * redhat.vscode-xml, so initializeMetadataSupport hits the no-redhat branch and writes through the
 * legacy wrapper backed by the single services channel — asserting the channel exists, is written
 * to, and is not duplicated. Org-free: no target-org is required.
 */
test("Core output channel (Code Builder): single 'Salesforce CLI' channel, wired to services layer", async ({
  page
}) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('wait for workbench', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    // First container boot stacks telemetry/what's-new toasts that can cover the output toolbar.
    await clearAllNotifications(page);
    await saveScreenshot(page, 'coreOutputChannel.container.01-ready.png');
  });

  await test.step('metadataXmlSupport wrote to the services-owned channel via getCoreChannelService', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, CORE_CHANNEL, 30_000);
    // Core harness installs no redhat.vscode-xml, so initializeMetadataSupport hits the no-redhat
    // branch and writes this via the legacy wrapper backed by the single services channel.
    await waitForOutputChannelText(page, {
      expectedText: messages.metadata_xml_no_redhat_extension_found,
      timeout: 30_000
    });
    await saveScreenshot(page, 'coreOutputChannel.container.02-text-verified.png');
  });

  await test.step('exactly one Salesforce CLI channel exists (dedupe guard)', async () => {
    const count = await countOutputChannelOptions(page, CORE_CHANNEL);
    expect(count, `expected exactly one '${CORE_CHANNEL}' output channel`).toBe(1);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
