/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';

import {
  APEX_TRACE_FLAG_STATUS_BAR,
  EDITOR_WITH_URI,
  closeSettingsTab,
  createMinimalOrg,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  hidePanel,
  openFileFromExplorerTree,
  removeAllDebugLevels,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  upsertSettings,
  verifyCommandExists,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';
import { waitForTraceFlagStatusBar } from '../helpers';

test.describe.configure({ mode: 'serial', timeout: 180_000 });

const LOG_POLL_INTERVAL_SETTING = 'salesforcedx-vscode-apex-log.logPollIntervalSeconds';

test('Auto-collection: poll interval setting, trace flag triggers collector, disable via 0', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup minimal org auth', async () => {
    await setupMinimalOrgAndAuth(page);
    await closeSettingsTab(page);
    await ensureSecondarySideBarHidden(page);

    // Wait for apex-log to activate (status bar is hidden until orgId is set). Match either
    // state here — if a previous run left a trace flag on the org, the status bar will show
    // "Tracing until ..." instead of "No Tracing". The next block handles the cleanup.
    await waitForTraceFlagStatusBar(page, /No Tracing|Tracing until/, 90_000);

    // Clean up any leftover trace flag from a previous run. Otherwise this test cannot reach
    // its own "No Tracing" starting state, and the following steps that rely on
    // `editorHasSelection`/`sf:has_target_org` contexts have nothing to do with the failure —
    // it's pure test-isolation leakage.
    const activeTraceFlag = page.locator(APEX_TRACE_FLAG_STATUS_BAR).filter({ hasText: /Tracing until/ });
    if (await activeTraceFlag.isVisible({ timeout: 1000 }).catch(() => false)) {
      await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsDeleteForCurrentUser']);
      await waitForTraceFlagStatusBar(page, /No Tracing/, 60_000);
    }

    await removeAllDebugLevels(page);
  });

  await test.step('set logPollIntervalSeconds to 10', async () => {
    await upsertSettings(page, { [LOG_POLL_INTERVAL_SETTING]: '10' });
    // Best-effort extra close in case `upsertSettings`'s internal close missed.
    await closeSettingsTab(page);
    // Re-confirm apex-log is still ready after the settings round-trip — the `sf:has_target_org`
    // context key is what gates the command's when-clause, and the trace-flag status bar being
    // visible implies that context is set. The status bar can briefly re-render while the
    // extension re-reads config, so poll rather than a single `toBeVisible` wait.
    await waitForTraceFlagStatusBar(page, /No Tracing/, 60_000);
    await saveScreenshot(page, 'auto-collect.poll-interval-set.png');
  });

  await test.step('create trace flag for current user', async () => {
    await verifyCommandExists(page, packageNls['apexLog.command.traceFlagsCreateForCurrentUser'], 60_000);
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsCreateForCurrentUser']);
    await expect(page.locator(APEX_TRACE_FLAG_STATUS_BAR).filter({ hasText: /Tracing until/ })).toBeVisible({
      timeout: 60_000
    });
    await saveScreenshot(page, 'auto-collect.trace-flag-created.png');
  });

  await test.step('generate an ApexLog and verify its auto-collected file and content', async () => {
    const { instanceUrl, accessToken, instanceApiVersion } = await createMinimalOrg();
    const toolingUrl = `${instanceUrl}/services/data/v${instanceApiVersion}/tooling`;
    const headers = { Authorization: `Bearer ${accessToken}` };
    const marker = `AutoCollection${Date.now()}`;
    const startedAt = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
    // Generate outside the extension: its execute-anonymous command saves separately and is excluded from collection.
    const execution = await page.request.get(`${toolingUrl}/executeAnonymous`, {
      headers,
      params: { anonymousBody: `System.debug('${marker}');` }
    });
    expect(execution.ok(), 'Tooling API executeAnonymous succeeds').toBe(true);
    expect(await execution.json(), 'Apex compiles and executes').toMatchObject({ compiled: true, success: true });

    const queryLogs = async () => {
      const response = await page.request.get(`${toolingUrl}/query`, {
        headers,
        params: {
          q: `SELECT Id FROM ApexLog WHERE StartTime >= ${startedAt} AND Operation LIKE '%executeAnonymous%' ORDER BY StartTime DESC LIMIT 1`
        }
      });
      expect(response.ok(), 'Tooling API log query succeeds').toBe(true);
      return response.json() as Promise<{ records: { Id: string }[] }>;
    };
    await expect.poll(async () => (await queryLogs()).records.length, { timeout: 60_000 }).toBe(1);
    const [{ Id: logId }] = (await queryLogs()).records;
    await selectOutputChannel(page, 'Salesforce Apex Log');
    await waitForOutputChannelText(page, { expectedText: `Auto-collected log ${logId}`, timeout: 60_000 });
    await hidePanel(page);
    // Opening the folder/file does not retrieve a log; this file must have been written by auto-collection.
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.openLogsFolder']);
    await openFileFromExplorerTree(page, `${logId}.log`, ['.sfdx', 'tools', 'debug', 'logs']);
    await expect(page.locator(`${EDITOR_WITH_URI}[data-uri$="/${logId}.log"]`)).toContainText(marker);
    await saveScreenshot(page, 'auto-collect.saved-log.png');
  });

  await test.step('set logPollIntervalSeconds to 0 to disable auto-collection', async () => {
    await upsertSettings(page, { [LOG_POLL_INTERVAL_SETTING]: '0' });
    await closeSettingsTab(page);
    await saveScreenshot(page, 'auto-collect.poll-disabled.png');
  });

  await test.step('cleanup: delete trace flag', async () => {
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.traceFlagsDeleteForCurrentUser']);
    await waitForTraceFlagStatusBar(page, /No Tracing/);
    await saveScreenshot(page, 'auto-collect.cleanup.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
