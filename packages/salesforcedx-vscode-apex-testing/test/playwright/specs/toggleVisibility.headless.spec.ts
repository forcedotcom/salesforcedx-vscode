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
  closeAllEditors,
  createAndDeployApexTestClass,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  isDesktop,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNonTrackingOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../package.nls.json';
import { desktopTest as test } from '../fixtures/desktopFixtures';
import { TEST_RUN_TIMEOUT } from '../constants';
import {
  TEST_EXPLORER_PANEL,
  TEST_EXPLORER_TREE_ITEM,
  openTestExplorerAndDiscover
} from '../helpers/testExplorerHelpers';

const treeRow = (panel: Locator, name: string): Locator =>
  panel.locator(TEST_EXPLORER_TREE_ITEM).filter({ hasText: new RegExp(name, 'i') });

(isDesktop() ? test : test.skip.bind(test))(
  'Toggle visibility commands hide and show local/org test classes independently',
  async ({ page, workspaceDir }) => {
    test.setTimeout(TEST_RUN_TIMEOUT);
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    const stamp = Date.now();
    const localClassName = `ToggleLocalClass${stamp}`;
    const orgOnlyClassName = `ToggleOrgOnlyClass${stamp}`;
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
      await createAndDeployApexTestClass(page, localClassName, makeClass(localClassName));
      await createAndDeployApexTestClass(page, orgOnlyClassName, makeClass(orgOnlyClassName));
      await saveScreenshot(page, 'toggle-visibility.classes-deployed.png');
    });

    await test.step('delete one class from local source so it becomes org-only', async () => {
      await fs.rm(orgOnlyClsPath, { force: true });
      await fs.rm(`${orgOnlyClsPath}-meta.xml`, { force: true });
      await saveScreenshot(page, 'toggle-visibility.org-only-source-removed.png');
    });

    let panel: Locator;
    await test.step('discover both classes in the Test Explorer', async () => {
      await closeAllEditors(page);
      panel = await openTestExplorerAndDiscover(page);
      await expect(treeRow(panel, localClassName).first()).toBeVisible({ timeout: 60_000 });
      await expect(treeRow(panel, orgOnlyClassName).first()).toBeVisible({ timeout: 60_000 });
      await saveScreenshot(page, 'toggle-visibility.both-visible.png');
    });

    await test.step('hide local tests — local class hidden, org-only class still visible', async () => {
      await executeCommandWithCommandPalette(page, packageNls.apex_test_hide_local_text);
      panel = page.locator(TEST_EXPLORER_PANEL);
      await expect(treeRow(panel, localClassName).first()).toBeHidden({ timeout: 60_000 });
      await expect(treeRow(panel, orgOnlyClassName).first()).toBeVisible({ timeout: 60_000 });
      await saveScreenshot(page, 'toggle-visibility.local-hidden.png');
    });

    await test.step('show local tests — local class reappears', async () => {
      await executeCommandWithCommandPalette(page, packageNls.apex_test_show_local_text);
      panel = page.locator(TEST_EXPLORER_PANEL);
      await expect(treeRow(panel, localClassName).first()).toBeVisible({ timeout: 60_000 });
      await expect(treeRow(panel, orgOnlyClassName).first()).toBeVisible({ timeout: 60_000 });
      await saveScreenshot(page, 'toggle-visibility.local-restored.png');
    });

    await test.step('hide org-only tests — org-only class hidden, local class still visible', async () => {
      await executeCommandWithCommandPalette(page, packageNls.apex_test_hide_org_text);
      panel = page.locator(TEST_EXPLORER_PANEL);
      await expect(treeRow(panel, orgOnlyClassName).first()).toBeHidden({ timeout: 60_000 });
      await expect(treeRow(panel, localClassName).first()).toBeVisible({ timeout: 60_000 });
      await saveScreenshot(page, 'toggle-visibility.org-hidden.png');
    });

    await test.step('show org-only tests — org-only class reappears', async () => {
      await executeCommandWithCommandPalette(page, packageNls.apex_test_show_org_text);
      panel = page.locator(TEST_EXPLORER_PANEL);
      await expect(treeRow(panel, orgOnlyClassName).first()).toBeVisible({ timeout: 60_000 });
      await expect(treeRow(panel, localClassName).first()).toBeVisible({ timeout: 60_000 });
      await saveScreenshot(page, 'toggle-visibility.org-restored.png');
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
