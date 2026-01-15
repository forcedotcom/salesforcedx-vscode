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
  assertWelcomeTabExists,
  closeWelcomeTabs,
  createDreamhouseOrg,
  upsertScratchOrgAuthFieldsToSettings,
  executeCommandWithCommandPalette,
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  outputChannelContains,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { nls } from '../../../src/messages';
import packageNls from '../../../package.nls.json';

test('View Changes Commands: each view changes command shows correct sections in output', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup scratch org and wait for status bar', async () => {
    const createResult = await createDreamhouseOrg();
    await waitForVSCodeWorkbench(page);
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);

    const statusBar = new SourceTrackingStatusBarPage(page);
    await statusBar.waitForVisible(120_000);
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
  });

  await test.step('View All Changes shows source tracking details', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await clearOutputChannel(page);
    await page.screenshot({ path: 'test-results/01-after-clear.png' });

    await executeCommandWithCommandPalette(page, packageNls.view_all_changes_text);
    await page.screenshot({ path: 'test-results/02-after-command.png' });

    const titleAllChanges = nls.localize('source_tracking_title_all_changes');

    // Wait for the output to appear - check for the title
    await waitForOutputChannelText(page, { expectedText: titleAllChanges });
    await page.screenshot({ path: 'test-results/03-after-wait-title.png' });

    // Verify title is present
    const hasTitle = await outputChannelContains(page, titleAllChanges);
    expect(hasTitle, `View All Changes should show "${titleAllChanges}" title`).toBe(true);

    const sectionRemote = nls.localize('source_tracking_section_remote_changes');
    const sectionLocal = nls.localize('source_tracking_section_local_changes');

    // Verify both remote and local sections are present
    const hasRemote = await outputChannelContains(page, sectionRemote);
    await page.screenshot({ path: 'test-results/04-after-remote-check.png' });
    expect(hasRemote, `View All Changes should show "${sectionRemote}" section`).toBe(true);

    const hasLocal = await outputChannelContains(page, sectionLocal);
    await page.screenshot({ path: 'test-results/05-after-local-check.png' });
    expect(hasLocal, `View All Changes should show "${sectionLocal}" section`).toBe(true);
  });

  await test.step('View Local Changes shows local section title', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.view_local_changes_text);

    const titleLocalChanges = nls.localize('source_tracking_title_local_changes');
    const sectionLocal = nls.localize('source_tracking_section_local_changes');
    const sectionRemote = nls.localize('source_tracking_section_remote_changes');

    // Wait for the local changes title to appear in output
    await waitForOutputChannelText(page, { expectedText: titleLocalChanges });

    // Verify local section header is present (section is "Local Changes (X):")
    const hasLocal = await outputChannelContains(page, `${sectionLocal} (`);
    expect(hasLocal, `View Local Changes should show "${sectionLocal}" section`).toBe(true);

    // Verify remote section is NOT present
    const hasRemote = await outputChannelContains(page, `${sectionRemote} (`);
    expect(hasRemote, `View Local Changes should NOT show "${sectionRemote}" section`).toBe(false);
  });

  await test.step('View Remote Changes shows remote section title', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, packageNls.view_remote_changes_text);

    const titleRemoteChanges = nls.localize('source_tracking_title_remote_changes');
    const sectionRemote = nls.localize('source_tracking_section_remote_changes');
    const sectionLocal = nls.localize('source_tracking_section_local_changes');

    // Wait for the remote changes title to appear in output
    await waitForOutputChannelText(page, { expectedText: titleRemoteChanges });

    // Verify remote section header is present (section is "Remote Changes (X):")
    const hasRemote = await outputChannelContains(page, `${sectionRemote} (`);
    expect(hasRemote, `View Remote Changes should show "${sectionRemote}" section`).toBe(true);

    // Verify local section is NOT present
    const hasLocal = await outputChannelContains(page, `${sectionLocal} (`);
    expect(hasLocal, `View Remote Changes should NOT show "${sectionLocal}" section`).toBe(false);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
