/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers Generate Project Info: the report is generated, written to .sf/project-info.md, and opened
 * in the editor. Desktop/web-only historically because the report queries the org (gated via
 * isDesktop() in plain web mode).
 *
 * Container: the container runs the desktop build plus the sf CLI against the boot-authed org, so it
 * is NOT gated behind isDesktop(). No source is created or mutated; the command reads project + org
 * metadata only.
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
    if (isContainer) {
      test.setTimeout(DEPLOY_TIMEOUT);
    }
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    await test.step('setup', async () => {
      if (isContainer) {
        // The containerTest fixture already awaited workbench readiness before handing over `page`.
        await closeWelcomeTabs(page);
        await ensureSecondarySideBarHidden(page);
        await saveScreenshot(page, 'projectInfo.01-ready.png');
      } else {
        const createResult = await createMinimalOrg();
        await waitForVSCodeWorkbench(page);
        await closeWelcomeTabs(page);
        await ensureSecondarySideBarHidden(page);
        await upsertScratchOrgAuthFieldsToSettings(page, createResult);
        await saveScreenshot(page, 'setup.after-auth.png');
      }
    });

    await test.step('run Generate Project Info command', async () => {
      await executeCommandWithCommandPalette(page, packageNls.project_info_text);
      await saveScreenshot(page, isContainer ? 'projectInfo.02-after-command.png' : 'step1.after-command.png');
    });

    await test.step('notification appears with written message', async () => {
      const notification = page
        .locator(NOTIFICATION_LIST_ITEM)
        .filter({ hasText: messages.project_info_written_message })
        .first();
      await expect(notification, 'Project info notification should be visible').toBeVisible({ timeout: 60_000 });
      await saveScreenshot(page, isContainer ? 'projectInfo.03-notification.png' : 'step2.notification-visible.png');
    });

    await test.step('clicking Open opens project-info.md in editor', async () => {
      const notification = page
        .locator(NOTIFICATION_LIST_ITEM)
        .filter({ hasText: messages.project_info_written_message })
        .first();
      await notification.getByRole('button', { name: messages.open_button }).click();
      await saveScreenshot(page, isContainer ? 'projectInfo.04-after-open.png' : 'step3.after-open-click.png');

      const editor = page.locator(`${EDITOR}[data-uri*="project-info.md"]`).first();
      await editor.waitFor({ state: 'visible', timeout: 15_000 });
      await saveScreenshot(page, isContainer ? 'projectInfo.05-editor-visible.png' : 'step3.editor-visible.png');
    });

    await test.step('editor contains expected report sections', async () => {
      const editorContent = page.locator(`${EDITOR}[data-uri*="project-info.md"]`).first();
      await expect(editorContent.getByText('# Project Info'), 'Editor should have # Project Info heading').toBeVisible({
        timeout: 10_000
      });
      await expect(editorContent.getByText('## Metadata'), 'Editor should have ## Metadata section').toBeVisible({
        timeout: 5000
      });

      if (isContainer) {
        // The mounted fixture has many metadata types, so the long Metadata table pushes the
        // Environment section below the fold. The editor virtualizes off-screen lines, so scroll to the
        // end of the document (Ctrl+End renders the trailing Environment + Extensions sections) before
        // asserting.
        await editorContent.click();
        await page.keyboard.press('Control+End');
      }
      await expect(editorContent.getByText('## Environment'), 'Editor should have ## Environment section').toBeVisible({
        timeout: isContainer ? 10_000 : 5000
      });
      await saveScreenshot(page, isContainer ? 'projectInfo.06-content-verified.png' : 'step4.content-verified.png');
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
