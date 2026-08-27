/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  clearAllNotifications,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  openFileFromExplorerTree,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { expect } from '@playwright/test';
import { containerTest as test } from '../../fixtures/containerFixtures';

/*
 * Proves the fixture project is actually mounted and opened: the container's coder.json points at
 * the bind-mounted test/playwright/fixtures/container-workspace, so the Explorer shows real
 * metadata. Opening PagedResult.cls asserts the seed reached the editor — the starting point for
 * specs that need existing metadata (open a class, run a test, deploy) rather than the bare
 * generated project. If the mount or coder.json write regressed, this fails instead of silently
 * running against an empty workspace.
 */
test('Seeded workspace (Code Builder): opens fixture Apex class from the Explorer', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('wait for workbench', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await clearAllNotifications(page);
    await saveScreenshot(page, 'seededWorkspace.container.01-ready.png');
  });

  await test.step('open the fixture class from the Explorer', async () => {
    await openFileFromExplorerTree(page, 'PagedResult.cls', ['force-app', 'main', 'default', 'classes']);
    await expect(page.getByText('public with sharing class PagedResult').first()).toBeVisible({ timeout: 15_000 });
    await saveScreenshot(page, 'seededWorkspace.container.02-class-open.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
