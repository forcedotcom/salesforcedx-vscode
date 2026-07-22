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
  waitForVSCodeWorkbench,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';
import { test } from '../fixtures';

const CHANNEL = 'Apex';

test("Apex output channel: single 'Apex' channel, wired to services layer", async ({ page }) => {
  test.setTimeout(60_000);

  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('wait for workbench', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
    await saveScreenshot(page, 'apexOutputChannel.01-ready.png');
  });

  await test.step("the 'Apex' channel exists post-activation (eager getChannel resolve)", async () => {
    await ensureOutputPanelOpen(page);
    // activateEffect eagerly resolves the services-owned ChannelService, creating the 'Apex' channel.
    await selectOutputChannel(page, CHANNEL, 10_000);
    await saveScreenshot(page, 'apexOutputChannel.02-selected.png');
  });

  await test.step('exactly one Apex channel exists (dedupe guard)', async () => {
    const count = await countOutputChannelOptions(page, CHANNEL);
    expect(count, `expected exactly one '${CHANNEL}' output channel`).toBe(1);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
