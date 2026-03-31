/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { trackingConflictTest as test } from '../../fixtures/desktopFixtures';
import {
  createApexClass,
  deployCurrentSourceToOrg,
  openFileByName,
  editOpenFile,
  executeCommandWithCommandPalette,
  saveScreenshot
} from '@salesforce/playwright-vscode-ext';
import { expect } from '@playwright/test';
import packageNls from '../../../../package.nls.json';
import { waitForRetrieveProgressNotificationToAppear } from '../../pages/notifications';
import { DEPLOY_TIMEOUT } from '../../../constants';
import { ConflictModalPage } from '../pages/conflictModalPage';
import { ConflictTreePage } from '../pages/conflictTreePage';
import { DiffEditorPage } from '../pages/diffEditorPage';

test.describe('Retrieve Conflict Detection (Source Tracking)', () => {
  test('detects conflict, views diff, then overrides and retrieves', async ({
    page,
    helperProject,
    statusBarPage
  }) => {
    const className = `Retrieve${Date.now().toString(36).slice(-6).toUpperCase()}`;

    await test.step('1. Create and deploy baseline', async () => {
      await createApexClass(page, className, `public class ${className} { /* v1 */ }`);
      await saveScreenshot(page, 'retrieve-conflict-1-created.png');

      await deployCurrentSourceToOrg(page);
      // Wait for local:0 to ensure updateTrackingFromDeploy has fully completed before helperProject runs.
      await statusBarPage.waitForCounts({ local: 0, conflicts: 0 }, 60_000);
      await saveScreenshot(page, 'retrieve-conflict-2-deployed.png');
    });

    await test.step('2. Helper project creates remote conflict', async () => {
      await helperProject(className, `public class ${className} { /* remote v2 */ }`);
    });

    await test.step('3. Modify locally (different from remote)', async () => {
      await openFileByName(page, `${className}.cls`);
      await editOpenFile(page, 'local v2 modification');
      await saveScreenshot(page, 'retrieve-conflict-3-local-modified.png');
    });

    await test.step('4-5. Wait for status bar to detect conflict', async () => {
      await statusBarPage.waitForCounts({ conflicts: 1 }, 60_000);
      expect(await statusBarPage.hasErrorBackground(), 'Status bar should show error background when conflict detected').toBe(true);
      await saveScreenshot(page, 'retrieve-conflict-4-conflict-detected.png');
    });

    const modal = new ConflictModalPage(page);
    const tree = new ConflictTreePage(page);
    const diff = new DiffEditorPage(page);

    await test.step('6. Trigger retrieve - conflict modal appears', async () => {
      await openFileByName(page, `${className}.cls`);
      await executeCommandWithCommandPalette(page, packageNls.retrieve_this_source_text);
      await modal.waitForVisible();
      await saveScreenshot(page, 'retrieve-conflict-5-modal.png');
    });

    await test.step('7. View Conflicts - tree shows file, clicking opens diff editor', async () => {
      await modal.clickViewConflicts('retrieve');
      await saveScreenshot(page, 'retrieve-conflict-6-view-conflicts-clicked.png');

      await tree.waitForItem(`${className}.cls`);
      await saveScreenshot(page, 'retrieve-conflict-7-tree-item-visible.png');

      await tree.clickItem(`${className}.cls`);
      await diff.waitForTab(className);
      await saveScreenshot(page, 'retrieve-conflict-8-diff-editor.png');
    });

    await test.step('8. Override conflicts and retrieve successfully', async () => {
      await openFileByName(page, `${className}.cls`);
      await executeCommandWithCommandPalette(page, packageNls.retrieve_this_source_text);
      await modal.waitForVisible();
      await modal.clickOverride('retrieve');
      await saveScreenshot(page, 'retrieve-conflict-9-override-clicked.png');

      const retrievingNotification = await waitForRetrieveProgressNotificationToAppear(page, 15_000);
      await expect(retrievingNotification, 'Retrieve should complete after override').not.toBeVisible({
        timeout: DEPLOY_TIMEOUT
      });
      await saveScreenshot(page, 'retrieve-conflict-10-retrieved.png');
    });

    await test.step('9. Validate conflict cleared after override retrieve', async () => {
      await statusBarPage.waitForCounts({ conflicts: 0 });
      expect(await statusBarPage.hasErrorBackground(), 'Status bar should not show error background after retrieve').toBe(false);
      await saveScreenshot(page, 'retrieve-conflict-11-conflict-cleared.png');
    });
  });
});
