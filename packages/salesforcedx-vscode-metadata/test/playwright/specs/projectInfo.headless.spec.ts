/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers Generate Project Info: the report is generated, written to .sf/project-info.md, and opened
 * in the editor. Skipped in plain web mode because the report queries the org.
 *
 * Container: runs against the container's boot-authed org instead of a freshly created minimal org. No
 * source is created or mutated; the command reads project + org metadata only.
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
  validateNoCriticalErrors,
  ensureSecondarySideBarHidden,
  isDesktop,
  saveScreenshot,
  NOTIFICATION_LIST_ITEM,
  EDITOR,
  resetContainerWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { messages } from '../../../src/messages/i18n';
import { DEPLOY_TIMEOUT } from '../../constants';
import { isContainer, sharedTest as test } from '../fixtures';

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
}

(isContainer || isDesktop() ? test : test.skip.bind(test))(
  'Project Info: writes report and opens file',
  async ({ page }) => {
    test.setTimeout(DEPLOY_TIMEOUT);
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

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
      await saveScreenshot(page, 'projectInfo.01-ready.png');
    });

    await test.step('run Generate Project Info command', async () => {
      await executeCommandWithCommandPalette(page, packageNls.project_info_text);
      await saveScreenshot(page, 'projectInfo.02-after-command.png');
    });

    await test.step('notification appears with written message', async () => {
      const notification = page
        .locator(NOTIFICATION_LIST_ITEM)
        .filter({ hasText: messages.project_info_written_message })
        .first();
      await expect(notification, 'Project info notification should be visible').toBeVisible({ timeout: 60_000 });
      await saveScreenshot(page, 'projectInfo.03-notification.png');
    });

    await test.step('clicking Open opens project-info.md in editor', async () => {
      const notification = page
        .locator(NOTIFICATION_LIST_ITEM)
        .filter({ hasText: messages.project_info_written_message })
        .first();
      await notification.getByRole('button', { name: messages.open_button }).click();
      await saveScreenshot(page, 'projectInfo.04-after-open.png');

      const editor = page.locator(`${EDITOR}[data-uri*="project-info.md"]`).first();
      await editor.waitFor({ state: 'visible', timeout: 15_000 });
      await saveScreenshot(page, 'projectInfo.05-editor-visible.png');
    });

    await test.step('editor contains expected report sections', async () => {
      const editorContent = page.locator(`${EDITOR}[data-uri*="project-info.md"]`).first();
      await expect(editorContent.getByText('# Project Info'), 'Editor should have # Project Info heading').toBeVisible({
        timeout: 10_000
      });
      await expect(editorContent.getByText('## Metadata'), 'Editor should have ## Metadata section').toBeVisible({
        timeout: 5000
      });

      // A project with many metadata types has a long Metadata table that pushes the Environment section
      // below the fold, and the editor virtualizes off-screen lines. Jump to the end of the document
      // (renders the trailing Environment + Extensions sections) before asserting.
      await editorContent.click();
      await page.keyboard.press('Control+End');
      await expect(editorContent.getByText('## Environment'), 'Editor should have ## Environment section').toBeVisible({
        timeout: 10_000
      });
      await saveScreenshot(page, 'projectInfo.06-content-verified.png');
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
