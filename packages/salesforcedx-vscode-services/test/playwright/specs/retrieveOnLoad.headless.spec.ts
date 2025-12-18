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
  setupNetworkMonitoring,
  filterErrors,
  filterNetworkErrors,
  upsertScratchOrgAuthFieldsToSettings,
  closeWelcomeTabs,
  ensureOutputPanelOpen,
  selectOutputChannel,
  waitForOutputChannelText,
  outputChannelContains,
  createMinimalOrg
} from '@salesforce/playwright-vscode-ext';
import { upsertRetrieveOnLoadSetting } from '../pages/settingsPage';
import { SERVICES_CHANNEL_NAME } from '../../../src/constants';

test.describe('retrieveOnLoad', () => {
  test('retrieves metadata on load for CustomObject:Activity and Workflow:Case', async ({ page }) => {
    test.setTimeout(10 * 60 * 1000); // 10 minutes for org creation and metadata retrieval

    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    await test.step('setup org auth and configure retrieveOnLoad setting', async () => {
      const orgAuth = await createMinimalOrg();
      await upsertScratchOrgAuthFieldsToSettings(page, orgAuth);

      // Set the retrieveOnLoad setting
      await upsertRetrieveOnLoadSetting(page, 'CustomObject:Activity, Workflow:Case');

      await closeWelcomeTabs(page);
    });

    await test.step('verify output channel shows retrieval message', async () => {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, SERVICES_CHANNEL_NAME);

      await waitForOutputChannelText(page, { expectedText: 'Retrieving metadata on load', timeout: 60_000 });

      const hasCustomObject = await outputChannelContains(page, 'CustomObject:Activity');
      const hasWorkflow = await outputChannelContains(page, 'Workflow:Case');

      expect(hasCustomObject, 'Should show CustomObject:Activity in retrieval message').toBe(true);
      expect(hasWorkflow, 'Should show Workflow:Case in retrieval message').toBe(true);
    });

    await test.step('verify success message in output channel', async () => {
      await waitForOutputChannelText(page, { expectedText: 'Retrieve on load completed', timeout: 300_000 });
      const hasFileCount = await outputChannelContains(page, 'files retrieved successfully');
      expect(hasFileCount, 'Should show file count in success message').toBe(true);
    });

    await test.step('verify editor tabs contain retrieved files', async () => {
      const tabs = page.locator('.monaco-workbench .tabs-container .tab');
      const tabTexts = await tabs.allTextContents();

      // Should have at least 1 file open (Activity object and/or Case workflow)
      expect(tabTexts.length, `Should have opened files, got: ${tabTexts.join(', ')}`).toBeGreaterThanOrEqual(1);

      // Check that we have files related to our metadata
      const hasActivityOrCase = tabTexts.some(
        text => text.toLowerCase().includes('activity') || text.toLowerCase().includes('case')
      );
      expect(hasActivityOrCase, `Expected Activity or Case related files, got: ${tabTexts.join(', ')}`).toBe(true);
    });

    await test.step('validate no critical errors', async () => {
      const criticalConsole = filterErrors(consoleErrors);
      const criticalNetwork = filterNetworkErrors(networkErrors);
      expect(criticalConsole, `Console errors: ${criticalConsole.map(e => e.text).join(' | ')}`).toHaveLength(0);
      expect(criticalNetwork, `Network errors: ${criticalNetwork.map(e => e.description).join(' | ')}`).toHaveLength(0);
    });
  });

  test('handles empty retrieveOnLoad setting gracefully', async ({ page }) => {
    test.setTimeout(5 * 60 * 1000);
    const consoleErrors = setupConsoleMonitoring(page);

    await test.step('setup org auth without retrieveOnLoad setting', async () => {
      const orgAuth = await createMinimalOrg();
      await upsertScratchOrgAuthFieldsToSettings(page, orgAuth);
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

  test('handles project resolution with retry logic', async ({ page }) => {
    test.setTimeout(10 * 60 * 1000);

    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    await test.step('setup org auth and configure retrieveOnLoad setting', async () => {
      const orgAuth = await createMinimalOrg();
      await upsertScratchOrgAuthFieldsToSettings(page, orgAuth);
      await upsertRetrieveOnLoadSetting(page, 'CustomObject:Account');
      await closeWelcomeTabs(page);
    });

    await test.step('verify project resolution succeeds', async () => {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, SERVICES_CHANNEL_NAME);

      // Should not see project resolution failure message
      await waitForOutputChannelText(page, { expectedText: 'Retrieving metadata on load', timeout: 90_000 });

      const hasProjectFailure = await outputChannelContains(page, 'Project resolution failed');
      expect(hasProjectFailure, 'Should not fail project resolution with retry logic').toBe(false);
    });

    await test.step('verify retrieval completes successfully', async () => {
      await waitForOutputChannelText(page, { expectedText: 'Retrieve on load completed', timeout: 300_000 });
      const hasFileCount = await outputChannelContains(page, 'files retrieved successfully');
      expect(hasFileCount, 'Should show file count in success message').toBe(true);
    });

    await test.step('validate no critical errors', async () => {
      const criticalConsole = filterErrors(consoleErrors);
      const criticalNetwork = filterNetworkErrors(networkErrors);
      expect(
        criticalConsole,
        `Console errors: ${criticalConsole.map((e: { text: string }) => e.text).join(' | ')}`
      ).toHaveLength(0);
      expect(
        criticalNetwork,
        `Network errors: ${criticalNetwork.map((e: { description: string }) => e.description).join(' | ')}`
      ).toHaveLength(0);
    });
  });
});
