/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers Install Package: posts a PackageInstallRequest and polls to success. Installs the publicly-
 * installable Electron theme package version (no installation key) by 04t id, so no org-specific/
 * private package is required.
 *
 * fixme (CONTAINER ONLY): nondeterministic on the shared, persistent boot org. The first attempt
 * installs the 04t (a slow, up-to-10-minute operation); on Playwright retries that same package is
 * already installed, so the install-key / "wait for completion?" quick-input flow short-circuits and
 * the poll prompt never appears (the "Yes" option waitFor times out). Re-running the install
 * deterministically would require uninstalling first, which adds its own flakiness — skip until the
 * boot org gives a clean slate. Desktop/web are NOT fixme'd — each run gets a fresh org.
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
  saveScreenshot,
  activeQuickInputTextField,
  activeQuickInputWidget,
  selectQuickInputOption,
  NOTIFICATION_LIST_ITEM,
  resetContainerWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { messages } from '../../../src/messages/i18n';
import { isContainer, sharedTest as test } from '../fixtures';

const ELECTRON_THEME_PACKAGE_VERSION_ID = '04t6A000002zgKSQAY';

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
}

(isContainer ? test.fixme.bind(test) : test)(
  'Install Package: posts PackageInstallRequest and polls until success',
  async ({ page }) => {
    test.setTimeout(10 * 60_000);
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    await test.step('setup', async () => {
      if (isContainer) {
        // The containerTest fixture already awaited workbench readiness before handing over `page`.
        await closeWelcomeTabs(page);
        await ensureSecondarySideBarHidden(page);
        await saveScreenshot(page, 'packageInstall.01-ready.png');
      } else {
        const createResult = await createMinimalOrg();
        await waitForVSCodeWorkbench(page);
        await closeWelcomeTabs(page);
        await ensureSecondarySideBarHidden(page);
        await upsertScratchOrgAuthFieldsToSettings(page, createResult);
        await saveScreenshot(page, 'setup.after-auth.png');
      }
    });

    await test.step('run Install Package and submit 04t', async () => {
      await executeCommandWithCommandPalette(page, packageNls.package_install_text);
      const idInput = activeQuickInputWidget(page);
      await idInput.waitFor({ state: 'visible', timeout: 30_000 });
      await page.keyboard.type(ELECTRON_THEME_PACKAGE_VERSION_ID);
      await page.keyboard.press('Enter');
      await saveScreenshot(page, isContainer ? 'packageInstall.02-after-id.png' : 'step1.after-id.png');
    });

    await test.step('skip installation key', async () => {
      const keyInput = activeQuickInputWidget(page);
      await keyInput.waitFor({ state: 'visible', timeout: 30_000 });
      await expect(page.getByRole('progressbar')).not.toBeVisible({ timeout: 30_000 });
      await activeQuickInputTextField(page).press('Enter');
      await keyInput.getByRole('option', { name: messages.package_install_poll_yes }).waitFor({
        state: 'visible',
        timeout: 30_000
      });
      await saveScreenshot(page, isContainer ? 'packageInstall.03-after-key.png' : 'step2.after-key.png');
    });

    await test.step('select Yes to wait for completion', async () => {
      await selectQuickInputOption(page, messages.package_install_poll_yes, {
        quickInputVisibleTimeout: 30_000
      });
      await saveScreenshot(
        page,
        isContainer ? 'packageInstall.04-after-poll-choice.png' : 'step3.after-poll-choice.png'
      );
    });

    await test.step('success notification appears', async () => {
      const expectedMessage = messages.package_install_succeeded_message.replace(
        '%s',
        ELECTRON_THEME_PACKAGE_VERSION_ID
      );
      const notification = page.locator(NOTIFICATION_LIST_ITEM).filter({ hasText: expectedMessage }).first();
      await expect(notification, 'Package install success notification should be visible').toBeVisible({
        timeout: 5 * 60_000
      });
      await saveScreenshot(page, isContainer ? 'packageInstall.05-success.png' : 'step4.success.png');
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
