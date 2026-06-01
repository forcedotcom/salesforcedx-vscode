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
  saveScreenshot,
  activeQuickInputWidget,
  NOTIFICATION_LIST_ITEM
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { messages } from '../../../src/messages/i18n';

const ELECTRON_THEME_PACKAGE_VERSION_ID = '04t6A000002zgKSQAY';

test('Install Package: posts PackageInstallRequest and polls until success', async ({ page }) => {
  test.setTimeout(10 * 60_000);
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

  await test.step('run Install Package and submit 04t', async () => {
    await executeCommandWithCommandPalette(page, packageNls.package_install_text);
    const idInput = activeQuickInputWidget(page);
    await idInput.waitFor({ state: 'visible', timeout: 30_000 });
    await page.keyboard.type(ELECTRON_THEME_PACKAGE_VERSION_ID);
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step1.after-id.png');
  });

  await test.step('skip installation key', async () => {
    const keyInput = activeQuickInputWidget(page);
    await keyInput.waitFor({ state: 'visible', timeout: 30_000 });
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step2.after-key.png');
  });

  await test.step('select Yes to wait for completion', async () => {
    const pollPick = activeQuickInputWidget(page);
    await pollPick.waitFor({ state: 'visible', timeout: 30_000 });
    await pollPick.getByRole('option', { name: messages.package_install_poll_yes }).first().click();
    await saveScreenshot(page, 'step3.after-poll-choice.png');
  });

  await test.step('success notification appears', async () => {
    const expectedMessage = messages.package_install_succeeded_message.replace('%s', ELECTRON_THEME_PACKAGE_VERSION_ID);
    const notification = page.locator(NOTIFICATION_LIST_ITEM).filter({ hasText: expectedMessage }).first();
    await expect(notification, 'Package install success notification should be visible').toBeVisible({
      timeout: 5 * 60_000
    });
    await saveScreenshot(page, 'step4.success.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
