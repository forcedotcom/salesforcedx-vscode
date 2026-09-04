/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for Generate Project Info. The web twin (projectInfo.headless.spec.ts)
 * was desktop-gated because the report queries the org; the container runs the desktop build plus the
 * sf CLI against the boot-authed org, so the desktop gate is removed here. This proves the report is
 * generated, written to .sf/project-info.md, and opened from inside the Code Builder image.
 *
 * No source is created or mutated; the command reads project + org metadata only.
 */

import { expect } from '@playwright/test';
import {
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  EDITOR,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  NOTIFICATION_LIST_ITEM,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { messages } from '../../../../src/messages/i18n';
import packageNls from '../../../../package.nls.json';
import { DEPLOY_TIMEOUT } from '../../../constants';
import { containerTest as test } from '../../fixtures/containerFixtures';

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('Project Info (Code Builder): writes report and opens file', async ({ page }) => {
  test.setTimeout(DEPLOY_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'projectInfo.container.01-ready.png');
  });

  await test.step('run Generate Project Info command', async () => {
    await executeCommandWithCommandPalette(page, packageNls.project_info_text);
    await saveScreenshot(page, 'projectInfo.container.02-after-command.png');
  });

  await test.step('notification appears with written message', async () => {
    const notification = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: messages.project_info_written_message })
      .first();
    await expect(notification, 'Project info notification should be visible').toBeVisible({ timeout: 60_000 });
    await saveScreenshot(page, 'projectInfo.container.03-notification.png');
  });

  await test.step('clicking Open opens project-info.md in editor', async () => {
    const notification = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: messages.project_info_written_message })
      .first();
    await notification.getByRole('button', { name: messages.open_button }).click();
    await saveScreenshot(page, 'projectInfo.container.04-after-open.png');

    const editor = page.locator(`${EDITOR}[data-uri*="project-info.md"]`).first();
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'projectInfo.container.05-editor-visible.png');
  });

  await test.step('editor contains expected report sections', async () => {
    const editorContent = page.locator(`${EDITOR}[data-uri*="project-info.md"]`).first();
    await expect(editorContent.getByText('# Project Info'), 'Editor should have # Project Info heading').toBeVisible({
      timeout: 10_000
    });
    await expect(editorContent.getByText('## Metadata'), 'Editor should have ## Metadata section').toBeVisible({
      timeout: 5000
    });
    await expect(editorContent.getByText('## Environment'), 'Editor should have ## Environment section').toBeVisible({
      timeout: 5000
    });
    await saveScreenshot(page, 'projectInfo.container.06-content-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
