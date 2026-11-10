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
 * minimal org.
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

  await test.step('setup', async () => {
    if (isContainer) {
      // The containerTest fixture already awaited workbench readiness before handing over `page`.
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      // The status bar appearing confirms source tracking is active against the boot org before we run
      // the View Changes commands.
      const statusBar = new SourceTrackingStatusBarPage(page);
      await statusBar.waitForVisible(120_000);
      await saveScreenshot(page, 'viewChangesCommands.01-ready.png');
    } else {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);

      const statusBar = new SourceTrackingStatusBarPage(page);
      await statusBar.waitForVisible(120_000);
    }
  });

  await test.step('View All Changes shows source tracking details', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);
    if (!isContainer) {
      await page.screenshot({ path: 'test-results/01-after-clear.png' });
    }

    await executeCommandWithCommandPalette(page, packageNls.view_all_changes_text);
    if (!isContainer) {
      await page.screenshot({ path: 'test-results/02-after-command.png' });
    }

    // Wait for the output to appear - check for the title
    await waitForOutputChannelText(page, { expectedText: messages.source_tracking_title_all_changes });
    if (!isContainer) {
      await page.screenshot({ path: 'test-results/03-after-wait-title.png' });
    }

    // Verify both remote and local sections are present
    await waitForOutputChannelText(page, { expectedText: messages.source_tracking_section_remote_changes });
    if (!isContainer) {
      await page.screenshot({ path: 'test-results/04-after-remote-check.png' });
    }
    await waitForOutputChannelText(page, { expectedText: messages.source_tracking_section_local_changes });
    if (isContainer) {
      await saveScreenshot(page, 'viewChangesCommands.02-all-changes.png');
    } else {
      await page.screenshot({ path: 'test-results/05-after-local-check.png' });
    }
  });

  await test.step('View Local Changes shows local section title', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);
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
    if (isContainer) {
      await saveScreenshot(page, 'viewChangesCommands.03-local-changes.png');
    }
  });

  await test.step('View Remote Changes shows remote section title', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await clearOutputChannel(page);
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
    if (isContainer) {
      await saveScreenshot(page, 'viewChangesCommands.04-remote-changes.png');
    }
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
