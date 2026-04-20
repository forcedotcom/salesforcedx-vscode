/*
 * Copyright (c) 2026, salesforce.com, inc.
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
  validateNoCriticalErrors,
  ensureSecondarySideBarHidden,
  isDesktop,
  saveScreenshot,
  NOTIFICATION_LIST_ITEM,
  EDITOR
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { messages } from '../../../src/messages/i18n';

(isDesktop() ? test : test.skip.bind(test))(
  'Project Info: writes report and opens file',
  async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    await test.step('setup minimal org', async () => {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
      await saveScreenshot(page, 'setup.after-auth.png');
    });

    await test.step('run Generate Project Info command', async () => {
      await executeCommandWithCommandPalette(page, packageNls.project_info_text);
      await saveScreenshot(page, 'step1.after-command.png');
    });

    await test.step('notification appears with written message', async () => {
      const notification = page
        .locator(NOTIFICATION_LIST_ITEM)
        .filter({ hasText: messages.project_info_written_message })
        .first();
      await expect(notification, 'Project info notification should be visible').toBeVisible({ timeout: 60_000 });
      await saveScreenshot(page, 'step2.notification-visible.png');
    });

    await test.step('clicking Open opens project-info.md in editor', async () => {
      const notification = page
        .locator(NOTIFICATION_LIST_ITEM)
        .filter({ hasText: messages.project_info_written_message })
        .first();
      await notification.getByRole('button', { name: messages.open_button }).click();
      await saveScreenshot(page, 'step3.after-open-click.png');

      const editor = page.locator(`${EDITOR}[data-uri*="project-info.md"]`).first();
      await editor.waitFor({ state: 'visible', timeout: 15_000 });
      await saveScreenshot(page, 'step3.editor-visible.png');
    });

    await test.step('editor contains expected report sections', async () => {
      const editorContent = page.locator(`${EDITOR}[data-uri*="project-info.md"]`).first();
      await expect(editorContent.getByText('# Project Info'), 'Editor should have # Project Info heading').toBeVisible({ timeout: 10_000 });
      await expect(editorContent.getByText('## Metadata'), 'Editor should have ## Metadata section').toBeVisible({ timeout: 5000 });
      await expect(editorContent.getByText('## Environment'), 'Editor should have ## Environment section').toBeVisible({ timeout: 5000 });
      await saveScreenshot(page, 'step4.content-verified.png');
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
