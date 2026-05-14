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
  saveScreenshot,
  upsertSettings
} from '@salesforce/playwright-vscode-ext';
import { expect } from '@playwright/test';
import { waitForDeployProgressNotificationToAppear } from '../../pages/notifications';
import { DEPLOY_TIMEOUT } from '../../../constants';

test.describe('Disabled Conflict Detection', () => {
  test('should skip conflict detection when setting is enabled', async ({ page, helperProject, statusBarPage }) => {
    const className = `DisabledCD${Date.now().toString(36).slice(-6).toUpperCase()}`;

    await test.step('0. Enable the disableConflictDetection setting', async () => {
      await upsertSettings(page, {
        'salesforcedx-vscode-metadata.sourceTracking.disableConflictDetection': 'true'
      });
      await saveScreenshot(page, 'disabled-cd-0-setting-enabled.png');
    });

    await test.step('1. Create and deploy baseline', async () => {
      await createApexClass(page, className, `public class ${className} { /* v1 */ }`);
      await saveScreenshot(page, 'disabled-cd-1-created.png');

      await deployCurrentSourceToOrg(page);
      // Give it time to complete
      await page.waitForTimeout(5000);
      await saveScreenshot(page, 'disabled-cd-2-deployed.png');
    });

    await test.step('2. Helper project creates remote conflict', async () => {
      await helperProject(className, `public class ${className} { /* remote v2 */ }`);
      await saveScreenshot(page, 'disabled-cd-3-helper-modified.png');
    });

    await test.step('3. Modify locally (different from remote)', async () => {
      await openFileByName(page, `${className}.cls`);
      await editOpenFile(page, 'local v2 modification');
      await saveScreenshot(page, 'disabled-cd-4-local-modified.png');
    });

    await test.step('4. Verify status bar does NOT show conflicts', async () => {
      // Wait a reasonable time for status bar to potentially detect conflicts
      await page.waitForTimeout(10_000);

      // Status bar should be hidden when conflict detection is disabled
      const statusBarText = await statusBarPage.getText();
      expect(statusBarText).toBeNull();

      await saveScreenshot(page, 'disabled-cd-5-no-status-bar.png');
    });

    await test.step('5. Deploy without conflict detection', async () => {
      await openFileByName(page, `${className}.cls`);
      await executeCommandWithCommandPalette(page, 'SFDX: Deploy This Source to Org');

      // No conflict modal should appear - deploy should proceed directly
      const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);

      await expect(deployingNotification, 'Deploy should complete without conflict modal').not.toBeVisible({
        timeout: DEPLOY_TIMEOUT
      });

      await saveScreenshot(page, 'disabled-cd-6-deployed-without-conflict-check.png');
    });

    await test.step('6. Re-enable conflict detection and verify it works', async () => {
      // Re-enable conflict detection
      await upsertSettings(page, {
        'salesforcedx-vscode-metadata.sourceTracking.disableConflictDetection': 'false'
      });
      await saveScreenshot(page, 'disabled-cd-7-setting-disabled.png');

      // Make another remote change
      await helperProject(className, `public class ${className} { /* remote v3 */ }`);

      // Modify locally again
      await openFileByName(page, `${className}.cls`);
      await editOpenFile(page, 'local v3 modification');

      // Now conflicts should be detected
      await statusBarPage.waitForCounts({ conflicts: 1 }, 60_000);
      expect(
        await statusBarPage.hasErrorBackground(),
        'Status bar should show error background when conflict detection is re-enabled'
      ).toBe(true);

      await saveScreenshot(page, 'disabled-cd-8-conflict-detected-after-reenabling.png');
    });
  });

  test('should deploy successfully with disabled conflict detection even with conflicts', async ({
    page,
    helperProject,
    statusBarPage
  }) => {
    const className = `NoCD${Date.now().toString(36).slice(-6).toUpperCase()}`;

    await test.step('Setup: disable conflict detection', async () => {
      await upsertSettings(page, {
        'salesforcedx-vscode-metadata.sourceTracking.disableConflictDetection': 'true'
      });
    });

    await test.step('Create baseline and create conflict', async () => {
      await createApexClass(page, className, `public class ${className} { /* v1 */ }`);
      await deployCurrentSourceToOrg(page);
      await page.waitForTimeout(5000);

      // Create remote conflict
      await helperProject(className, `public class ${className} { /* remote */ }`);

      // Modify locally
      await openFileByName(page, `${className}.cls`);
      await editOpenFile(page, 'local modification');
    });

    await test.step('Deploy should succeed without conflict modal', async () => {
      await openFileByName(page, `${className}.cls`);
      await executeCommandWithCommandPalette(page, 'SFDX: Deploy This Source to Org');

      // Deploy should proceed and complete successfully
      const deployingNotification = await waitForDeployProgressNotificationToAppear(page, 30_000);
      await expect(deployingNotification, 'Deploy should complete').not.toBeVisible({
        timeout: DEPLOY_TIMEOUT
      });

      await saveScreenshot(page, 'no-cd-deployed-successfully.png');
    });
  });
});
