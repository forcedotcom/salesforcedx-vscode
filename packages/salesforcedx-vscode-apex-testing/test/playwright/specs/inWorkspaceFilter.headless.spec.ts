/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { expect, type Locator } from '@playwright/test';
import {
  clearFilter,
  createAndDeployApexTestClass,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  focusAndTypeInFilter,
  isDesktop,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNonTrackingOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';

// Import the desktop fixture directly (not the web/desktop union from `../fixtures`) so
// `workspaceDir` is typed; the web run still collects this file but `test.skip` (below) never
// executes the desktop-only body. Making a class "org-only" needs real on-disk source removal.
import { desktopTest as test } from '../fixtures/desktopFixtures';
import { TEST_RUN_TIMEOUT } from '../constants';
import {
  TEST_EXPLORER_PANEL,
  TEST_EXPLORER_TREE_ITEM,
  openTestExplorerAndDiscover
} from '../helpers/testExplorerHelpers';

// Regression guard for W-22691592 / issue #7350: VS Code's Test Explorer tag filter matches by
// TestTag id across ALL controllers. The Apex controller tags workspace classes `in-workspace` and
// org-only classes `org-only`. This locks in the Apex side of the contract the LWC fix relies on:
// `@in-workspace` shows local classes and hides org-only ones. The companion LWC assertion lives in
// salesforcedx-vscode-lwc/test/playwright/specs/lwcRunTests.desktop.spec.ts.
const treeRow = (panel: Locator, name: string): Locator =>
  panel.locator(TEST_EXPLORER_TREE_ITEM).filter({ hasText: new RegExp(name, 'i') });

(isDesktop() ? test : test.skip.bind(test))(
  'Apex @in-workspace filter shows local classes and hides org-only classes',
  async ({ page, workspaceDir }) => {
    test.setTimeout(TEST_RUN_TIMEOUT);
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    const stamp = Date.now();
    const workspaceClassName = `InWorkspaceClass${stamp}`;
    const orgOnlyClassName = `OrgOnlyClass${stamp}`;
    const makeClass = (name: string): string =>
      [
        '@isTest',
        `public class ${name} {`,
        '\t@isTest',
        '\tstatic void passes() {',
        `\t\tSystem.assertEquals(1, 1, '${name}');`,
        '\t}',
        '}'
      ].join('\n');
    const classesDir = path.join(workspaceDir, 'force-app', 'main', 'default', 'classes');
    const orgOnlyClsPath = path.join(classesDir, `${orgOnlyClassName}.cls`);

    await test.step('setup non-tracking org and deploy two Apex test classes', async () => {
      await setupNonTrackingOrgAndAuth(page);
      await ensureSecondarySideBarHidden(page);
      await createAndDeployApexTestClass(page, workspaceClassName, makeClass(workspaceClassName));
      await createAndDeployApexTestClass(page, orgOnlyClassName, makeClass(orgOnlyClassName));
      await saveScreenshot(page, 'in-workspace.classes-deployed.png');
    });

    await test.step('delete one class from local source so it becomes org-only', async () => {
      await fs.rm(orgOnlyClsPath, { force: true });
      await fs.rm(`${orgOnlyClsPath}-meta.xml`, { force: true });
      await expect(async () => {
        await expect(fs.access(orgOnlyClsPath)).rejects.toThrow();
      }).toPass({ timeout: 10_000 });
      await saveScreenshot(page, 'in-workspace.org-only-source-removed.png');
    });

    let panel: Awaited<ReturnType<typeof openTestExplorerAndDiscover>>;
    await test.step('discover both classes in the Test Explorer', async () => {
      // The deleted class left a preview editor open; close all editors so discovery is clean.
      await executeCommandWithCommandPalette(page, 'View: Close All Editors');
      panel = await openTestExplorerAndDiscover(page);
      await expect(treeRow(panel, workspaceClassName).first()).toBeVisible({ timeout: 60_000 });
      await expect(treeRow(panel, orgOnlyClassName).first()).toBeVisible({ timeout: 60_000 });
    });

    await test.step('apply @in-workspace — local class visible, org-only class hidden', async () => {
      panel = page.locator(TEST_EXPLORER_PANEL);
      await expect(async () => {
        await clearFilter(page);
        await focusAndTypeInFilter(page, '@in-workspace');
        await expect(treeRow(panel, workspaceClassName).first()).toBeVisible({ timeout: 3000 });
        await expect(treeRow(panel, orgOnlyClassName).first()).toBeHidden({ timeout: 3000 });
      }).toPass({ timeout: 60_000 });
      await saveScreenshot(page, 'in-workspace.filtered.png');
    });

    await test.step('clear filter — both classes visible again', async () => {
      await clearFilter(page);
      await expect(treeRow(panel, workspaceClassName).first()).toBeVisible({ timeout: 15_000 });
      await expect(treeRow(panel, orgOnlyClassName).first()).toBeVisible({ timeout: 15_000 });
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
