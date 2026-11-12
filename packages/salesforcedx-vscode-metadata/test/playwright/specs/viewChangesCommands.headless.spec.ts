/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers the View Changes commands: each renders the correct output sections (titles present, wrong
 * section absent) — no absolute change counts asserted, so this is safe against the shared persistent
 * container workbench too.
 *
 * Container: runs against the container's boot-authed tracking org instead of a freshly created
 * minimal org. No source is created or mutated; the commands only read source-tracking state.
 */

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
  ensureSecondarySideBarHidden,
  resetContainerWorkbench,
  saveScreenshot
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { messages } from '../../../src/messages/i18n';
import packageNls from '../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../constants';
import { isContainer, sharedTest as test } from '../fixtures';

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
}

test('View Changes Commands: each view changes command shows correct sections in output', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  test.setTimeout(DEPLOY_TIMEOUT);

  // Start each command from an empty Salesforce Metadata channel so its output waits (and "section
  // absent" checks) only see that command's output, not an earlier step's.
  const clearMetadataOutput = async (): Promise<void> => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);
  };

  await test.step('setup', async () => {
    // The container's fixture already awaited the workbench, and its boot org is already authed.
    const createResult = isContainer ? undefined : await createMinimalOrg();
    if (!isContainer) {
      await waitForVSCodeWorkbench(page);
    }
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    if (createResult) {
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    }

    // The status bar appearing confirms source tracking is active against the default org before we
    // run the View Changes commands.
    const statusBar = new SourceTrackingStatusBarPage(page);
    await statusBar.waitForVisible(120_000);
    await saveScreenshot(page, 'viewChangesCommands.01-ready.png');
  });

  await test.step('View All Changes shows source tracking details', async () => {
    await clearMetadataOutput();
    await executeCommandWithCommandPalette(page, packageNls.view_all_changes_text);

    // Wait for the output to appear - check for the title
    await waitForOutputChannelText(page, { expectedText: messages.source_tracking_title_all_changes });

    // Verify both remote and local sections are present
    await waitForOutputChannelText(page, { expectedText: messages.source_tracking_section_remote_changes });
    await waitForOutputChannelText(page, { expectedText: messages.source_tracking_section_local_changes });
    await saveScreenshot(page, 'viewChangesCommands.02-all-changes.png');
  });

  await test.step('View Local Changes shows local section title', async () => {
    await clearMetadataOutput();
    await executeCommandWithCommandPalette(page, packageNls.view_local_changes_text);

    // Wait for the local changes title to appear in output
    await waitForOutputChannelText(page, { expectedText: messages.source_tracking_title_local_changes });

    // Verify local section header is present (section is "Local Changes (X):")
    await waitForOutputChannelText(page, { expectedText: `${messages.source_tracking_section_local_changes} (` });

    // Verify remote section is NOT present
    const hasRemote = await outputChannelContains(page, `${messages.source_tracking_section_remote_changes} (`);
    expect(
      hasRemote,
      `View Local Changes should NOT show "${messages.source_tracking_section_remote_changes}" section`
    ).toBe(false);
    await saveScreenshot(page, 'viewChangesCommands.03-local-changes.png');
  });

  await test.step('View Remote Changes shows remote section title', async () => {
    await clearMetadataOutput();
    await executeCommandWithCommandPalette(page, packageNls.view_remote_changes_text);

    // Wait for the remote changes title to appear in output
    await waitForOutputChannelText(page, { expectedText: messages.source_tracking_title_remote_changes });

    // Verify remote section header is present (section is "Remote Changes (X):")
    await waitForOutputChannelText(page, { expectedText: `${messages.source_tracking_section_remote_changes} (` });

    // Verify local section is NOT present
    const hasLocal = await outputChannelContains(page, `${messages.source_tracking_section_local_changes} (`);
    expect(
      hasLocal,
      `View Remote Changes should NOT show "${messages.source_tracking_section_local_changes}" section`
    ).toBe(false);
    await saveScreenshot(page, 'viewChangesCommands.04-remote-changes.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
