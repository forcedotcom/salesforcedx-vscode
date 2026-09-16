/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  acceptNotification,
  activeQuickInputTextField,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  waitForNotification,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { messages } from '../../../src/messages/i18n';
import fixturePackageNls from '../fixtureExtensions/missingDevHub/package.nls.json';
import { orgDesktopMissingDevHubTest as test } from '../fixtures/desktopFixtures';

const MISSING_DEV_HUB = /No target Dev Hub is set/;
const STATE_FILE = '.missing-dev-hub-state.json';

test('org create: missing Dev Hub prompt dismisses or starts authorization', async ({ page, workspaceDir }) => {
  test.setTimeout(120_000);

  await waitForVSCodeWorkbench(page);
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);

  try {
    await executeCommandWithCommandPalette(page, fixturePackageNls.missing_dev_hub_isolate_sf_home_test_text);
    await expect
      .poll(() => readFile(join(workspaceDir, STATE_FILE), 'utf8').catch(() => undefined), {
        message: 'isolated extension-host config should have no target Dev Hub',
        timeout: 30_000
      })
      .toBe('{"targetDevHub":null}');

    await test.step('dismiss the missing Dev Hub notification', async () => {
      await executeCommandWithCommandPalette(page, packageNls.org_create_default_scratch_org_text);
      const notification = await waitForNotification(page, MISSING_DEV_HUB);
      await notification.getByRole('button', { name: 'Clear Notification' }).click();
      await expect(notification).not.toBeVisible();
    });

    await test.step('selecting Authorize a Dev Hub starts its alias prompt', async () => {
      await executeCommandWithCommandPalette(page, packageNls.org_create_default_scratch_org_text);
      await acceptNotification(page, MISSING_DEV_HUB, messages.notification_make_default_dev);

      const aliasInput = activeQuickInputTextField(page);
      await expect(aliasInput, 'Dev Hub authorization alias input should open').toHaveAttribute(
        'placeholder',
        'vscodeOrg',
        { timeout: 30_000 }
      );
      await page.keyboard.press('Escape');
    });
  } finally {
    await executeCommandWithCommandPalette(page, fixturePackageNls.missing_dev_hub_restore_sf_home_test_text);
  }
});
