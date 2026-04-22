/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  activeQuickInputTextField,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  QUICK_INPUT_LIST_ROW,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForQuickInputFirstOption,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';
import { messages } from '../../../src/messages/i18n';
import packageNls from '../../../package.nls.json';
import { multiPackageNoOrgTest } from '../fixtures';

multiPackageNoOrgTest(
  'Apex Generate Class: both package directory classes folders appear in output directory picker',
  async ({ page }) => {
    multiPackageNoOrgTest.skip(
      process.env.VSCODE_DESKTOP !== '1',
      'requires desktop filesystem to set up multi-package workspace'
    );
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);
    const className = `MultiPkgDirTest${Date.now()}`;

    await multiPackageNoOrgTest.step('setup with no org', async () => {
      await waitForVSCodeWorkbench(page);
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await waitForWorkspaceReady(page);
      await saveScreenshot(page, 'setup.after-workbench.png');
    });

    await multiPackageNoOrgTest.step('command is present', async () => {
      await verifyCommandExists(page, packageNls.apex_generate_class_text, 120_000);
    });

    await multiPackageNoOrgTest.step('run Apex Generate Class command', async () => {
      await executeCommandWithCommandPalette(page, packageNls.apex_generate_class_text);
      await saveScreenshot(page, 'step.command-triggered.png');
    });

    await multiPackageNoOrgTest.step('select template in QuickPick', async () => {
      await waitForQuickInputFirstOption(page);
      await page.keyboard.press('Enter');
      await saveScreenshot(page, 'step.template-selected.png');
    });

    await multiPackageNoOrgTest.step('enter class name in InputBox', async () => {
      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
      await quickInput.getByText(messages.apex_class_name_prompt).waitFor({ state: 'visible', timeout: 10_000 });
      await activeQuickInputTextField(page).fill(className, { force: true });
      await page.keyboard.press('Enter');
      await saveScreenshot(page, 'step.class-name-entered.png');
    });

    await multiPackageNoOrgTest.step('both package directory classes folders appear as choices', async () => {
      await waitForQuickInputFirstOption(page);
      await saveScreenshot(page, 'step.directory-prompt-visible.png');

      const quickInput = page.locator(QUICK_INPUT_WIDGET);
      const rows = quickInput.locator(QUICK_INPUT_LIST_ROW);

      const forceAppRow = rows.filter({ hasText: 'force-app/main/default/classes' });
      const extraPkgRow = rows.filter({ hasText: 'extra-pkg/classes' });

      await expect(forceAppRow, 'force-app/main/default/classes should appear as a choice').toBeVisible({
        timeout: 10_000
      });
      await expect(extraPkgRow, 'extra-pkg/classes should appear as a choice').toBeVisible({
        timeout: 10_000
      });

      await saveScreenshot(page, 'step.both-dirs-visible.png');
      await page.keyboard.press('Escape');
    });

    await validateNoCriticalErrors(multiPackageNoOrgTest, consoleErrors, networkErrors);
  }
);
