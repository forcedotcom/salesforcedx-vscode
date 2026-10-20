/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { expect, type Locator } from '@playwright/test';
import {
  clearFilter,
  createApexClass,
  ensureSecondarySideBarHidden,
  env,
  execAsync,
  focusAndTypeInFilter,
  isDesktop,
  MINIMAL_ORG_ALIAS,
  NON_TRACKING_ORG_ALIAS,
  resetContainerWorkbench,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  setupNonTrackingOrgAndAuth,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';

import { isContainer, sharedTest as test } from '../fixtures';
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
//
// Discovery starts from the org's Tooling API and resolves each class to the workspace: present in
// both -> `in-workspace`, otherwise `org-only`. So both classes must be in the org, and only one in
// the workspace.
// Desktop's fixture targets the non-tracking org; the container uses its boot (minimal) org.
const ORG_ALIAS = isContainer ? MINIMAL_ORG_ALIAS : NON_TRACKING_ORG_ALIAS;

const treeRow = (panel: Locator, name: string): Locator =>
  panel.locator(TEST_EXPLORER_TREE_ITEM).filter({ hasText: new RegExp(name, 'i') });

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

const APEX_CLASS_META = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">',
  '    <apiVersion>64.0</apiVersion>',
  '    <status>Active</status>',
  '</ApexClass>'
].join('\n');

/**
 * ONE host-CLI deploy of both classes from a throwaway project, so the org-only class never enters the
 * workspace and nothing deploys through the extension (no source-tracking conflict prompt).
 * `--ignore-conflicts` keeps the container's source-tracked boot org from rejecting a fresh, unrelated project.
 */
const deployClassesFromHost = async (classNames: readonly string[]): Promise<void> => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'in-workspace-filter-'));
  try {
    const classesDir = path.join(tmpRoot, 'force-app', 'main', 'default', 'classes');
    await fs.mkdir(classesDir, { recursive: true });
    await fs.writeFile(
      path.join(tmpRoot, 'sfdx-project.json'),
      JSON.stringify({ packageDirectories: [{ path: 'force-app', default: true }], sourceApiVersion: '64.0' })
    );
    for (const name of classNames) {
      await fs.writeFile(path.join(classesDir, `${name}.cls`), makeClass(name));
      await fs.writeFile(path.join(classesDir, `${name}.cls-meta.xml`), APEX_CLASS_META);
    }
    await execAsync(
      `sf project deploy start --source-dir force-app --target-org ${ORG_ALIAS} --ignore-conflicts --json`,
      { cwd: tmpRoot, env }
    );
  } finally {
    await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
  }
};

// Shared persistent workbench: reset editor + notification state before each test.
test.beforeEach(async ({ page }) => {
  if (isContainer) {
    await resetContainerWorkbench(page);
  }
});

// salesforcedx-vscode-apex has no browser bundle, so the Test Controller never surfaces in VS Code Web.
// The container runs the desktop build in a Node host, so it's exercisable there.
(isDesktop() || isContainer ? test : test.skip.bind(test))(
  'Apex @in-workspace filter shows local classes and hides org-only classes',
  async ({ page }) => {
    test.setTimeout(TEST_RUN_TIMEOUT);
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    // Unique per run: the container's shared workbench and org keep classes from earlier runs.
    const stamp = Date.now();
    const workspaceClassName = `InWorkspaceClass${stamp}`;
    const orgOnlyClassName = `OrgOnlyClass${stamp}`;

    await test.step('create a workspace class, then deploy it and an org-only class from the host', async () => {
      if (!isContainer) {
        await setupNonTrackingOrgAndAuth(page);
      }
      // The container's boot org is authed on the host in the Code Builder CI. Skip — never false-fail —
      // on a local run without that setup, since the host deploy can't target it.
      const orgAuthedOnHost = await execAsync(`sf org display -o ${ORG_ALIAS} --json`, { env })
        .then(() => true)
        .catch(() => false);
      test.skip(!orgAuthedOnHost, `org "${ORG_ALIAS}" must be authed on the host to deploy the classes`);

      await ensureSecondarySideBarHidden(page);
      await createApexClass(page, workspaceClassName, makeClass(workspaceClassName));
      await deployClassesFromHost([workspaceClassName, orgOnlyClassName]);
      await saveScreenshot(page, 'in-workspace.classes-deployed.png');
    });

    let panel: Awaited<ReturnType<typeof openTestExplorerAndDiscover>>;
    await test.step('discover both classes in the Test Explorer', async () => {
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
