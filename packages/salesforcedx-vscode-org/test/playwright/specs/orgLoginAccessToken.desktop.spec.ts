/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  activeQuickInputWidget,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  NOTIFICATION_LIST_ITEM,
  QUICK_INPUT_WIDGET,
  setupMinimalOrgAndAuth,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { orgDesktopMinimalDefaultTest as test } from '../fixtures/desktopFixtures';

// e2e-COVERED: `sf.org.login.access.token` (Effect command, CLI/simpleExec) activation + prompt-appears + Esc cancel.
// Real session-ID auth can't run in e2e (no live session ID), so this proves: the command is registered
// on the Effect path (palette shows + runs it), the PromptService-backed gatherer surfaces the instanceUrl
// input box, and Esc maps UserCancellationError -> silent cancel (no error toast). The success path (CLI exec
// with the token on SF_ACCESS_TOKEN env, never on argv) is covered by jest (orgLoginAccessToken.test.ts).
// Note: this command has no project-open gate, so the spec does not depend on an sfdx-project being open.
test('org extension: Authorize an Org using Session ID prompts then cancels cleanly on Esc', async ({ page }) => {
  test.setTimeout(120_000);

  await test.step('setup scratch default org', async () => {
    await setupMinimalOrgAndAuth(page);
    await ensureSecondarySideBarHidden(page);
  });

  // Gate on an always-present activation command so we don't false-negative on slow startup.
  await test.step('verify extension is activated', async () => {
    await verifyCommandExists(page, packageNls.org_login_web_authorize_org_text, 60_000);
  });

  await test.step('run the command; the gatherer surfaces the instance URL input box', async () => {
    await executeCommandWithCommandPalette(page, packageNls.org_login_access_token_text);
    // first prompt of gatherAccessTokenParams is the instance URL input box
    await expect(activeQuickInputWidget(page)).toBeVisible({ timeout: 30_000 });
  });

  await test.step('Esc cancels the prompt (UserCancellationError -> silent cancel, no error toast)', async () => {
    await page.keyboard.press('Escape');
    await expect(page.locator(QUICK_INPUT_WIDGET)).toBeHidden({ timeout: 10_000 });
    await expect(
      page.locator(NOTIFICATION_LIST_ITEM).filter({ has: page.locator('.codicon-error') }),
      'a cancelled session-ID auth must not surface an error notification'
    ).toHaveCount(0);
  });
});
