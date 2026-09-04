/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the View Changes commands. The web twin (viewChangesCommands.headless.spec.ts)
 * proves each View Changes command renders the correct output sections on a plain Page; this proves the
 * same source-tracking status computation runs against a real org inside the Code Builder image, using the
 * container's boot-authed tracking org.
 *
 * Runs the three commands and asserts their output sections structurally (titles present, wrong section
 * absent) — no absolute change counts, so it is safe against the shared persistent workbench. The full
 * source-tracking/CLI path (extension -> sf -> org) web mode cannot cover.
 */

import {
  clearAllNotifications,
  clearOutputChannel,
  closeAllEditors,
  closeWelcomeTabs,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  outputChannelContains,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import { expect } from '@playwright/test';
import { SourceTrackingStatusBarPage } from '../../pages/sourceTrackingStatusBarPage';
import { messages } from '../../../../src/messages/i18n';
import packageNls from '../../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../../constants';
import { containerTest as test } from '../../fixtures/containerFixtures';

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('View Changes Commands (Code Builder): each command shows the correct output sections', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready and source tracking active', async () => {
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    // The status bar appearing confirms source tracking is active against the boot org before we run
    // the View Changes commands.
    const statusBar = new SourceTrackingStatusBarPage(page);
    await statusBar.waitForVisible(120_000);
    await saveScreenshot(page, 'viewChangesCommands.container.01-ready.png');
  });

  await test.step('View All Changes shows source tracking details', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, packageNls.view_all_changes_text);

    await waitForOutputChannelText(page, { expectedText: messages.source_tracking_title_all_changes });
    await waitForOutputChannelText(page, { expectedText: messages.source_tracking_section_remote_changes });
    await waitForOutputChannelText(page, { expectedText: messages.source_tracking_section_local_changes });
    await saveScreenshot(page, 'viewChangesCommands.container.02-all-changes.png');
  });

  await test.step('View Local Changes shows local section title only', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, packageNls.view_local_changes_text);

    await waitForOutputChannelText(page, { expectedText: messages.source_tracking_title_local_changes });
    await waitForOutputChannelText(page, { expectedText: `${messages.source_tracking_section_local_changes} (` });

    const hasRemote = await outputChannelContains(page, `${messages.source_tracking_section_remote_changes} (`);
    expect(
      hasRemote,
      `View Local Changes should NOT show "${messages.source_tracking_section_remote_changes}" section`
    ).toBe(false);
    await saveScreenshot(page, 'viewChangesCommands.container.03-local-changes.png');
  });

  await test.step('View Remote Changes shows remote section title only', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(page, packageNls.view_remote_changes_text);

    await waitForOutputChannelText(page, { expectedText: messages.source_tracking_title_remote_changes });
    await waitForOutputChannelText(page, { expectedText: `${messages.source_tracking_section_remote_changes} (` });

    const hasLocal = await outputChannelContains(page, `${messages.source_tracking_section_local_changes} (`);
    expect(
      hasLocal,
      `View Remote Changes should NOT show "${messages.source_tracking_section_local_changes}" section`
    ).toBe(false);
    await saveScreenshot(page, 'viewChangesCommands.container.04-remote-changes.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
