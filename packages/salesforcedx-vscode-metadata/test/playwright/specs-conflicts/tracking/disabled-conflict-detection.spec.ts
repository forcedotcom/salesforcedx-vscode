/*
 * Copyright (c) 2026, salesforce.com, inc.
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
  clearOutputChannel,
  ensureOutputPanelOpen,
  selectOutputChannel,
  saveScreenshot,
  upsertSettings
} from '@salesforce/playwright-vscode-ext';
import { expect } from '@playwright/test';
import { DEPLOY_TIMEOUT } from '../../../constants';

test.describe('Disabled Conflict Detection', () => {
  test.beforeEach(async () => {
    // Each scenario performs three real deployments plus source-tracking polling.
    test.setTimeout(4 * 60 * 1000);
  });
  test('re-enabling conflict detection detects existing remote and local changes', async ({
    page,
    helperProject,
    statusBarPage
  }) => {
    const className = `DisabledCD${Date.now().toString(36).slice(-6).toUpperCase()}`;

    await test.step('0. Disable conflict detection via setting', async () => {
      await upsertSettings(page, {
        'salesforcedx-vscode-metadata.sourceTracking.enableConflictDetection': 'false'
      });
      await saveScreenshot(page, 'disabled-cd-0-setting-disabled.png');
    });

    await test.step('1. Create and deploy baseline', async () => {
      await createApexClass(page, className, `public class ${className} { /* v1 */ }`);
      await saveScreenshot(page, 'disabled-cd-1-created.png');

      await deployCurrentSourceToOrg(page, { waitViaOutputChannel: true, deployCompleteTimeoutMs: DEPLOY_TIMEOUT });
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

    await test.step('4. Verify status bar shows disabled state', async () => {
      // Status bar should show disabled state - use a direct locator since the page object
      // expects the arrow-down/arrow-up pattern which won't match disabled state
      const disabledStatusBar = page.getByRole('button', { name: /Conflict Detection Disabled/ });
      await expect(disabledStatusBar).toBeVisible({ timeout: 15_000 });

      await saveScreenshot(page, 'disabled-cd-5-disabled-state.png');
    });

    await test.step('6. Re-enable conflict detection and verify it works', async () => {
      // Re-enable conflict detection
      await upsertSettings(page, {
        'salesforcedx-vscode-metadata.sourceTracking.enableConflictDetection': 'true'
      });
      await expect(page.getByRole('button', { name: /Conflict Detection Disabled/ })).toBeHidden();
      await saveScreenshot(page, 'disabled-cd-7-setting-enabled.png');

      // The existing remote/local changes should become conflicts once detection resumes.
      await openFileByName(page, `${className}.cls`);

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
        'salesforcedx-vscode-metadata.sourceTracking.enableConflictDetection': 'false'
      });
      await expect(page.getByRole('button', { name: /Conflict Detection Disabled/ })).toBeVisible();
    });

    await test.step('Create baseline and create conflict', async () => {
      await createApexClass(page, className, `public class ${className} { /* v1 */ }`);
      await deployCurrentSourceToOrg(page, { waitViaOutputChannel: true, deployCompleteTimeoutMs: DEPLOY_TIMEOUT });

      // Create remote conflict
      await helperProject(className, `public class ${className} { /* remote */ }`);

      // Modify locally
      await openFileByName(page, `${className}.cls`);
      await editOpenFile(page, 'local modification');
    });

    await test.step('Deploy should succeed without conflict modal', async () => {
      // Remove the baseline success line so this assertion must observe the new deployment.
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Metadata');
      await clearOutputChannel(page);
      await openFileByName(page, `${className}.cls`);
      await deployCurrentSourceToOrg(page, { waitViaOutputChannel: true, deployCompleteTimeoutMs: DEPLOY_TIMEOUT });

      await saveScreenshot(page, 'no-cd-deployed-successfully.png');
    });
  });
});
