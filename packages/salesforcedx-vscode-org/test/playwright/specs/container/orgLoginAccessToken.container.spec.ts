/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Code Builder container twin of orgLoginAccessToken.desktop (see
 * docs/adr/0022-code-builder-e2e-desktop-build-over-browser.md). Runs against the single shared
 * container fixture (an sfdx-project is open, satisfying the sf:project_opened gate) with the boot org
 * as default. Real session-ID auth cannot run in e2e (no live session ID), so this only surfaces the
 * access-token prompt then cancels with Esc — proving the command is registered on the Effect path,
 * the PromptService-backed gatherer opens the instance-URL input box, and Esc maps
 * UserCancellationError -> silent cancel (no error toast). It does NOT complete a real login.
 */

import { expect } from '@playwright/test';
import {
  activeQuickInputWidget,
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  NOTIFICATION_LIST_ITEM,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import { containerTest as test } from '../../fixtures/containerFixtures';
import packageNls from '../../../../package.nls.json';

// Shared persistent workbench: reset editor + notification state before each test rather than
// assuming a clean slate.
test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('org extension (Code Builder): Authorize an Org using Session ID prompts then cancels cleanly on Esc', async ({
  page
}) => {
  test.setTimeout(120_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('wait for workbench', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'orgLoginAccessToken.container.01-ready.png');
  });

  // Gate on an always-present activation command so we don't false-negative on slow startup.
  await test.step('verify extension is activated', async () => {
    await verifyCommandExists(page, packageNls.org_login_web_authorize_org_text, 60_000);
  });

  await test.step('run the command; the gatherer surfaces the instance URL input box', async () => {
    await executeCommandWithCommandPalette(page, packageNls.org_login_access_token_text);
    // first prompt of gatherAccessTokenParams is the instance URL input box
    await expect(activeQuickInputWidget(page)).toBeVisible({ timeout: 30_000 });
    await saveScreenshot(page, 'orgLoginAccessToken.container.02-prompt.png');
  });

  await test.step('Esc cancels the prompt (UserCancellationError -> silent cancel, no error toast)', async () => {
    await page.keyboard.press('Escape');
    await expect(page.locator(QUICK_INPUT_WIDGET)).toBeHidden({ timeout: 10_000 });
    await expect(
      page.locator(NOTIFICATION_LIST_ITEM).filter({ has: page.locator('.codicon-error') }),
      'a cancelled session-ID auth must not surface an error notification'
    ).toHaveCount(0);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
