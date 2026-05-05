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
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createMinimalOrg,
  upsertScratchOrgAuthFieldsToSettings,
  executeCommandWithCommandPalette,
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  outputChannelContains,
  validateNoCriticalErrors,
  ensureSecondarySideBarHidden
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { nls } from '../../../src/messages';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../constants';

test('View Changes Commands: each view changes command shows correct sections in output', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  test.setTimeout(DEPLOY_TIMEOUT);

  await test.step('setup scratch org and wait for status bar', async () => {
    const createResult = await createMinimalOrg();
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);

    const statusBar = new SourceTrackingStatusBarPage(page);
    await statusBar.waitForVisible(120_000);
  });

  await test.step('View All Changes shows source tracking details', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);
    await page.screenshot({ path: 'test-results/01-after-clear.png' });

    await executeCommandWithCommandPalette(page, packageNls.view_all_changes_text);
    await page.screenshot({ path: 'test-results/02-after-command.png' });

    const titleAllChanges = nls.localize('source_tracking_title_all_changes');

    // Wait for the output to appear - check for the title
    await waitForOutputChannelText(page, { expectedText: titleAllChanges });
    await page.screenshot({ path: 'test-results/03-after-wait-title.png' });

    const sectionRemote = nls.localize('source_tracking_section_remote_changes');
    const sectionLocal = nls.localize('source_tracking_section_local_changes');

    // Verify both remote and local sections are present
    await waitForOutputChannelText(page, { expectedText: sectionRemote });
    await page.screenshot({ path: 'test-results/04-after-remote-check.png' });
    await waitForOutputChannelText(page, { expectedText: sectionLocal });
    await page.screenshot({ path: 'test-results/05-after-local-check.png' });
  });

  await test.step('View Local Changes shows local section title', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.view_local_changes_text);

    const titleLocalChanges = nls.localize('source_tracking_title_local_changes');
    const sectionLocal = nls.localize('source_tracking_section_local_changes');
    const sectionRemote = nls.localize('source_tracking_section_remote_changes');

    // Wait for the local changes title to appear in output
    await waitForOutputChannelText(page, { expectedText: titleLocalChanges });

    // Verify local section header is present (section is "Local Changes (X):")
    await waitForOutputChannelText(page, { expectedText: `${sectionLocal} (` });

    // Verify remote section is NOT present
    const hasRemote = await outputChannelContains(page, `${sectionRemote} (`);
    expect(hasRemote, `View Local Changes should NOT show "${sectionRemote}" section`).toBe(false);
  });

  await test.step('View Remote Changes shows remote section title', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.view_remote_changes_text);

    const titleRemoteChanges = nls.localize('source_tracking_title_remote_changes');
    const sectionRemote = nls.localize('source_tracking_section_remote_changes');
    const sectionLocal = nls.localize('source_tracking_section_local_changes');

    // Wait for the remote changes title to appear in output
    await waitForOutputChannelText(page, { expectedText: titleRemoteChanges });

    // Verify remote section header is present (section is "Remote Changes (X):")
    await waitForOutputChannelText(page, { expectedText: `${sectionRemote} (` });

    // Verify local section is NOT present
    const hasLocal = await outputChannelContains(page, `${sectionLocal} (`);
    expect(hasLocal, `View Remote Changes should NOT show "${sectionLocal}" section`).toBe(false);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
