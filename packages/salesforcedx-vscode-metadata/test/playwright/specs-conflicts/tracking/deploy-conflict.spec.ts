/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { trackingConflictTest as test } from '../../fixtures';
import {
  createApexClass,
  deployCurrentSourceToOrg,
  openFileByName,
  editOpenFile,
  executeCommandWithCommandPalette,
  saveScreenshot
} from '@salesforce/playwright-vscode-ext';
import { expect } from '@playwright/test';
import { waitForDeployProgressNotificationToAppear } from '../../pages/notifications';
import { DEPLOY_TIMEOUT } from '../../../constants';
import { ConflictModalPage } from '../pages/conflictModalPage';
import { ConflictTreePage } from '../pages/conflictTreePage';
import { DiffEditorPage } from '../pages/diffEditorPage';

test.describe('Deploy Conflict Detection (Source Tracking)', () => {
  test('detects conflict, views diff, then overrides and deploys', async ({ page, helperProject, statusBarPage }) => {
    const className = `Deploy${Date.now().toString(36).slice(-6).toUpperCase()}`;

    await test.step('1. Create and deploy baseline', async () => {
      await createApexClass(page, className, `public class ${className} { /* v1 */ }`);
      await saveScreenshot(page, 'deploy-conflict-1-created.png');

      await deployCurrentSourceToOrg(page);
      // Wait for local:0 (not just conflicts:0) to ensure updateTrackingFromDeploy has fully completed.
      // conflicts:0 alone passes immediately (initial state), but local:0 only passes after tracking sync.
      await statusBarPage.waitForCounts({ local: 0, conflicts: 0 }, 60_000);
      await saveScreenshot(page, 'deploy-conflict-2-deployed.png');
    });

    await test.step('2. Helper project creates remote conflict', async () => {
      await helperProject(className, `public class ${className} { /* remote v2 */ }`);
    });

    await test.step('3. Modify locally (different from remote)', async () => {
      await openFileByName(page, `${className}.cls`);
      await editOpenFile(page, 'local v2 modification');
      await saveScreenshot(page, 'deploy-conflict-3-local-modified.png');
    });

    await test.step('4-5. Wait for status bar to detect conflict', async () => {
      await statusBarPage.waitForCounts({ conflicts: 1 }, 60_000);
      expect(
        await statusBarPage.hasErrorBackground(),
        'Status bar should show error background when conflict detected'
      ).toBe(true);
      await saveScreenshot(page, 'deploy-conflict-4-conflict-detected.png');
    });

    const modal = new ConflictModalPage(page);
    const tree = new ConflictTreePage(page);
    const diff = new DiffEditorPage(page);

    await test.step('6. Trigger deploy - conflict modal appears', async () => {
      await openFileByName(page, `${className}.cls`);
      await executeCommandWithCommandPalette(page, 'SFDX: Deploy This Source to Org');
      await modal.waitForVisible();
      await saveScreenshot(page, 'deploy-conflict-5-modal.png');
    });

    await test.step('7. View Conflicts - tree shows file, clicking opens diff editor', async () => {
      await modal.clickViewConflicts('deploy');
      await saveScreenshot(page, 'deploy-conflict-6-view-conflicts-clicked.png');

      await tree.waitForItem(`${className}.cls`);
      await saveScreenshot(page, 'deploy-conflict-7-tree-item-visible.png');

      await tree.clickItem(`${className}.cls`);
      await diff.waitForTab(className);
      await saveScreenshot(page, 'deploy-conflict-8-diff-editor.png');
    });

    await test.step('8. Override conflicts and deploy successfully', async () => {
      await openFileByName(page, `${className}.cls`);
      await executeCommandWithCommandPalette(page, 'SFDX: Deploy This Source to Org');
      await modal.waitForVisible();
      await modal.clickOverride('deploy');
      await saveScreenshot(page, 'deploy-conflict-9-override-clicked.png');

      const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
      await expect(deployingNotification, 'Deploy should complete after override').not.toBeVisible({
        timeout: DEPLOY_TIMEOUT
      });
      await saveScreenshot(page, 'deploy-conflict-10-deployed.png');
    });

    await test.step('9. Validate conflict cleared after override deploy', async () => {
      await statusBarPage.waitForCounts({ conflicts: 0 });
      expect(await statusBarPage.hasErrorBackground(), 'Status bar should not show error background after deploy').toBe(
        false
      );
      await saveScreenshot(page, 'deploy-conflict-11-conflict-cleared.png');
    });
  });
});
