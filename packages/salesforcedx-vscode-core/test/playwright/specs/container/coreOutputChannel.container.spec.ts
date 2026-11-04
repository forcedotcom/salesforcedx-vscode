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

const CORE_CHANNEL = 'Salesforce CLI';

/*
 * Container twin of coreOutputChannel.headless: proves the Code Builder container wires a single
 * services-owned 'Salesforce CLI' output channel. Unlike the desktop harness (which controls its
 * extension set), the container runs the FULL installed set, so whether redhat.vscode-xml is present
 * — and which initializeMetadataSupport branch fires (no-redhat / setup-success / setup-failed /
 * version regression) — is image-dependent. Every one of those branches logs a "metadata XML …"
 * status line through the legacy wrapper backed by the single services channel, so we assert on that
 * shared substring rather than one image-specific message: the point is that metadataXmlSupport wrote
 * to the channel, that the channel exists, and that it is not duplicated. Org-free: no target-org.
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
    // Every initializeMetadataSupport branch (no-redhat / setup-success / setup-failed / version
    // regression) logs a "metadata XML …" line. Assert that shared substring so this holds whatever
    // redhat.vscode-xml state the image ships — proving metadataXmlSupport wrote to the channel.
    await waitForOutputChannelText(page, { expectedText: 'metadata XML', timeout: 30_000 });
    await saveScreenshot(page, 'coreOutputChannel.container.02-text-verified.png');
  });

  await test.step('exactly one Salesforce CLI channel exists (dedupe guard)', async () => {
    const count = await countOutputChannelOptions(page, CORE_CHANNEL);
    expect(count, `expected exactly one '${CORE_CHANNEL}' output channel`).toBe(1);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
