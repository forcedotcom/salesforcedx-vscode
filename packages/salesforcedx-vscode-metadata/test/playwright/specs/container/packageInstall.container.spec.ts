/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for package install. The web twin (packageInstall.headless.spec.ts) proves
 * the Install Package command drives its quick-input flow on a plain Page; this proves the install
 * actually posts a PackageInstallRequest and polls to success against a real org inside the Code Builder
 * image, using the container's boot-authed org.
 *
 * Installs the publicly-installable Electron theme package version (no installation key) by 04t id, so no
 * org-specific/private package is required. The full package-install/CLI path (extension -> sf -> org) web
 * mode cannot cover.
 */

import {
  activeQuickInputTextField,
  activeQuickInputWidget,
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  NOTIFICATION_LIST_ITEM,
  saveScreenshot,
  selectQuickInputOption,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { expect } from '@playwright/test';
import { messages } from '../../../../src/messages/i18n';
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

// Publicly-installable Electron theme package version (no installation key), so any org can install it.
const ELECTRON_THEME_PACKAGE_VERSION_ID = '04t6A000002zgKSQAY';

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('Install Package (Code Builder): posts PackageInstallRequest and polls until success', async ({ page }) => {
  test.setTimeout(10 * 60_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'packageInstall.container.01-ready.png');
  });

  await test.step('run Install Package and submit 04t', async () => {
    await executeCommandWithCommandPalette(page, packageNls.package_install_text);
    const idInput = activeQuickInputWidget(page);
    await idInput.waitFor({ state: 'visible', timeout: 30_000 });
    await page.keyboard.type(ELECTRON_THEME_PACKAGE_VERSION_ID);
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'packageInstall.container.02-after-id.png');
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
    await saveScreenshot(page, 'packageInstall.container.03-after-key.png');
  });

  await test.step('select Yes to wait for completion', async () => {
    await selectQuickInputOption(page, messages.package_install_poll_yes, {
      quickInputVisibleTimeout: 30_000
    });
    await saveScreenshot(page, 'packageInstall.container.04-after-poll-choice.png');
  });

  await test.step('success notification appears', async () => {
    const expectedMessage = messages.package_install_succeeded_message.replace('%s', ELECTRON_THEME_PACKAGE_VERSION_ID);
    const notification = page.locator(NOTIFICATION_LIST_ITEM).filter({ hasText: expectedMessage }).first();
    await expect(notification, 'Package install success notification should be visible').toBeVisible({
      timeout: 5 * 60_000
    });
    await saveScreenshot(page, 'packageInstall.container.05-success.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
