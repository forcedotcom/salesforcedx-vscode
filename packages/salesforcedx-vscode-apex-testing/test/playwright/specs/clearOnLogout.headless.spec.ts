/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import {
  createAndDeployApexTestClass,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  isDesktop,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  setupNonTrackingOrgAndAuth,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';

// Import the desktop fixture directly (not the web/desktop union from `../fixtures`) so the
// web run still collects this file but `test.skip` (below) never runs the desktop-only body.
// Auth + deploy + logout need a real org on disk, so this is desktop only.
import { desktopTest as test } from '../fixtures/desktopFixtures';
import { TEST_RUN_TIMEOUT } from '../constants';
import { TEST_EXPLORER_TREE_ITEM, openTestExplorerAndDiscover } from '../helpers/testExplorerHelpers';

// `SFDX: Log Out from Default Org` — title from salesforcedx-vscode-org package.nls (`org_logout_default_text`).
const LOGOUT_COMMAND = 'SFDX: Log Out from Default Org';
// Confirm button on the scratch-org logout modal (`org_logout_scratch_logout` in salesforcedx-vscode-org i18n).
const LOGOUT_CONFIRM_LABEL = 'Logout';

/** Click a button on a `showWarningMessage({ modal: true })` dialog (requires `window.dialogStyle: custom`). */
const clickModalDialogButton = async (page: Page, label: string, timeout = 60_000): Promise<void> => {
  const dialogButton = page
    .locator('.monaco-dialog-box, .dialog-shadow')
    .getByRole('button', { name: label, exact: true })
    .first();
  await expect(dialogButton).toBeVisible({ timeout });
  await dialogButton.click();
};

(isDesktop() ? test : test.skip.bind(test))(
  'Apex Testing view clears on Log Out from Default Org without a window reload',
  async ({ page }) => {
    test.setTimeout(TEST_RUN_TIMEOUT);
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    const className = `ClearOnLogout${Date.now()}`;
    const classContent = `@isTest
public class ${className} {
    @isTest
    static void clearsOnLogout() {
        System.assertEquals(1, 1, 'should clear on logout');
    }
}`;
    const classItem = page
      .locator(TEST_EXPLORER_TREE_ITEM)
      .filter({ hasText: new RegExp(className, 'i') })
      .first();

    await test.step('setup non-tracking org and deploy an Apex test class', async () => {
      await setupNonTrackingOrgAndAuth(page);
      await ensureSecondarySideBarHidden(page);
      await createAndDeployApexTestClass(page, className, classContent);
      await saveScreenshot(page, 'setup.class-deployed.png');
    });

    await test.step('discover tests and confirm the class is in the tree', async () => {
      await openTestExplorerAndDiscover(page);
      await classItem.waitFor({ state: 'visible', timeout: 60_000 });
      await saveScreenshot(page, 'step.class-discovered.png');
    });

    await test.step('log out from the default org and confirm the scratch-org prompt', async () => {
      await executeCommandWithCommandPalette(page, LOGOUT_COMMAND);
      await clickModalDialogButton(page, LOGOUT_CONFIRM_LABEL);
      await saveScreenshot(page, 'step.logged-out.png');
    });

    await test.step('the org-discovered class disappears from the tree without a reload', async () => {
      // This is the bug: before the fix, the tree kept org-discovered tests until a window reload.
      // The org -> no-org transition alone must empty the tree.
      await expect(classItem).toBeHidden({ timeout: 60_000 });
      await saveScreenshot(page, 'step.tree-cleared.png');
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
