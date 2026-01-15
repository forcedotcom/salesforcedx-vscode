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
  upsertScratchOrgAuthFieldsToSettings,
  assertWelcomeTabExists,
  closeWelcomeTabs,
  ensureOutputPanelOpen,
  selectOutputChannel,
  waitForOutputChannelText,
  outputChannelContains,
  createMinimalOrg,
  filterErrors
} from '@salesforce/playwright-vscode-ext';
import { SERVICES_CHANNEL_NAME } from '../../../src/constants';

test('handles empty retrieveOnLoad setting gracefully', async ({ page }) => {
  test.setTimeout(5 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);

  await test.step('setup org auth without retrieveOnLoad setting', async () => {
    const orgAuth = await createMinimalOrg();
    await upsertScratchOrgAuthFieldsToSettings(page, orgAuth);
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
  });

  await test.step('verify no retrieval attempt', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, SERVICES_CHANNEL_NAME);

    // Wait for the extension to activate and process settings
    await waitForOutputChannelText(page, { expectedText: SERVICES_CHANNEL_NAME, timeout: 30_000 });

    const hasRetrieving = await outputChannelContains(page, 'Retrieving metadata on load');
    expect(hasRetrieving, 'Should not attempt retrieval with empty setting').toBe(false);
  });

  await test.step('validate no errors from empty setting', async () => {
    const criticalConsole = filterErrors(consoleErrors);
    expect(
      criticalConsole,
      `Console errors: ${criticalConsole.map((e: { text: string }) => e.text).join(' | ')}`
    ).toHaveLength(0);
  });
});
