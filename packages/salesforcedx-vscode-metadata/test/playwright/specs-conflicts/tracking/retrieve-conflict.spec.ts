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
  saveScreenshot
} from '@salesforce/playwright-vscode-ext';
import { expect } from '@playwright/test';

test.describe('Retrieve Conflict Detection (Source Tracking)', () => {
  test('detects conflict in status bar', async ({
    page,
    helperProject,
    statusBarPage
  }) => {
    const className = `Retrieve${Date.now().toString(36).slice(-6).toUpperCase()}`;

    await test.step('1. Create and deploy baseline', async () => {
      await createApexClass(page, className, `public class ${className} { /* v1 */ }`);
      await saveScreenshot(page, 'retrieve-conflict-1-created.png');

      await deployCurrentSourceToOrg(page);
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
      await statusBarPage.waitForCounts({ conflicts: 1 });
      expect(await statusBarPage.hasErrorBackground(), 'Status bar should show error background when conflict detected').toBe(true);
      await saveScreenshot(page, 'retrieve-conflict-4-conflict-detected.png');
    });
  });
});
