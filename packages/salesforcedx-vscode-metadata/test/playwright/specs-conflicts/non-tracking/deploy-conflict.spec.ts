/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { nonTrackingConflictTest as test } from '../../fixtures/desktopFixtures';
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
import { waitForDeployProgressNotificationToAppear } from '../../pages/notifications';
import { DEPLOY_TIMEOUT } from '../../../constants';
import { ConflictModalPage } from '../pages/conflictModalPage';
import { ConflictTreePage } from '../pages/conflictTreePage';
import { DiffEditorPage } from '../pages/diffEditorPage';

test.describe('Deploy Conflict Detection (Non-Source Tracking)', () => {
  test('detects conflict, views diff, then overrides and deploys', async ({
    page,
    helperProject
  }) => {
    const className = `NTDeploy${Date.now().toString(36).slice(-6).toUpperCase()}`;

    await test.step('1. Create and deploy baseline', async () => {
      await createApexClass(page, className, `public class ${className} { /* v1 */ }`);
      await saveScreenshot(page, 'non-tracking-deploy-1-created.png');

      await deployCurrentSourceToOrg(page);
      await saveScreenshot(page, 'non-tracking-deploy-2-deployed.png');
    });

    await test.step('2. Helper project creates remote conflict', async () => {
      await helperProject(className, `public class ${className} { /* remote v2 */ }`);
    });

    await test.step('3. Modify locally (different from remote)', async () => {
      await openFileByName(page, `${className}.cls`);
      await editOpenFile(page, 'local v2 modification');
      await saveScreenshot(page, 'non-tracking-deploy-3-local-modified.png');
    });

    const modal = new ConflictModalPage(page);
    const tree = new ConflictTreePage(page);
    const diff = new DiffEditorPage(page);

    await test.step('4. Trigger deploy - conflict modal appears', async () => {
      await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);
      await modal.waitForVisible(10_000);
      await saveScreenshot(page, 'non-tracking-deploy-4-conflict-modal.png');
    });

    await test.step('5. View Conflicts - tree shows file, clicking opens diff editor', async () => {
      await modal.clickViewConflicts('deploy');
      await saveScreenshot(page, 'non-tracking-deploy-5-view-conflicts-clicked.png');

      await tree.waitForItem(`${className}.cls`);
      await saveScreenshot(page, 'non-tracking-deploy-6-tree-item-visible.png');

      await tree.clickItem(`${className}.cls`);
      await diff.waitForTab(className);
      await saveScreenshot(page, 'non-tracking-deploy-7-diff-editor.png');
    });

    await test.step('6. Override conflicts and deploy successfully', async () => {
      await openFileByName(page, `${className}.cls`);
      await executeCommandWithCommandPalette(page, packageNls.deploy_this_source_text);
      await modal.waitForVisible(10_000);
      await modal.clickOverride('deploy');
      await saveScreenshot(page, 'non-tracking-deploy-8-override-clicked.png');

      const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
      await expect(deployingNotification, 'Deploy should complete after override').not.toBeVisible({ timeout: DEPLOY_TIMEOUT });
      await saveScreenshot(page, 'non-tracking-deploy-9-deployed.png');
    });

    await test.step('7. Validate conflict cleared after override deploy', async () => {
      await tree.waitForItemGone(`${className}.cls`);
      await saveScreenshot(page, 'non-tracking-deploy-10-conflict-cleared.png');
    });
  });
});
