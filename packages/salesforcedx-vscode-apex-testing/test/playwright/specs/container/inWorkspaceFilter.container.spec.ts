/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container port of inWorkspaceFilter.headless.spec.ts. The web twin is desktop-only because
 * salesforcedx-vscode-apex has no browser bundle, so the Test Controller never surfaces in VS Code
 * Web. The Code Builder image runs the DESKTOP build in a Node host, so the Apex LSP contributes the
 * class/method nodes and the `@in-workspace` tag filter is exercisable.
 *
 * Regression guard for W-22691592 / issue #7350: the Apex controller tags workspace classes
 * `in-workspace` and org-only classes `org-only`; `@in-workspace` must show local classes and hide
 * org-only ones. Discovery starts from the org's Tooling API and resolves each class to the
 * workspace: `presence === 'both'` -> in-workspace, otherwise org-only. So a class needs to be IN the
 * org to appear at all, and its workspace presence decides the tag.
 *
 * ORG: the BOOT org (minimalTestOrg, the source-tracking scratch org authed as the default
 * target-org). No second org / no org switching is needed — the in-workspace-vs-org-only distinction
 * is about workspace presence, not source tracking. (The desktop twin used a NON-tracking org only to
 * dodge the source-tracked "Override Conflicts and Deploy" UI-deploy modal; the org-only class here is
 * deployed from the HOST CLI, and the in-workspace class is a fresh uniquely-named class with no
 * conflict, so neither path hits that modal.)
 *
 * TWO CLASSES:
 *   - in-workspace: created in the mounted workspace AND deployed to the boot org via the extension
 *     (createAndDeployApexTestClass) -> presence 'both' -> `in-workspace`.
 *   - org-only: deployed to the boot org from the HOST CLI into a throwaway project, NEVER added to
 *     the workspace -> presence org-only -> `org-only`. (The desktop twin instead deploys then
 *     `fs.rm`s the on-disk file; container specs can't, because the workspace is a bind mount inside
 *     the container whose host path is not exposed to specs.)
 *
 * Skips (never false-fails) when the boot org isn't authed on the host — i.e. a local run without the
 * Code Builder multi-org CI setup that creates and auths minimalTestOrg on the host.
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { expect, type Locator } from '@playwright/test';
import {
  clearAllNotifications,
  clearFilter,
  closeAllEditors,
  createAndDeployApexTestClass,
  ensureSecondarySideBarHidden,
  env,
  execAsync,
  focusAndTypeInFilter,
  MINIMAL_ORG_ALIAS,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  TEST_EXPLORER_PANEL,
  TEST_EXPLORER_TREE_ITEM,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';

import { containerTest as test } from '../../fixtures/containerFixtures';
import { TEST_RUN_TIMEOUT } from '../../constants';
import { openTestExplorerAndDiscover } from '../../helpers/testExplorerHelpers';

const treeRow = (panel: Locator, name: string): Locator =>
  panel.locator(TEST_EXPLORER_TREE_ITEM).filter({ hasText: new RegExp(name, 'i') });

const APEX_CLASS_META = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">',
  '    <apiVersion>64.0</apiVersion>',
  '    <status>Active</status>',
  '</ApexClass>'
].join('\n');

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

/**
 * Deploy an Apex test class to the boot org from the HOST CLI into a throwaway project, WITHOUT ever
 * adding it to the container's mounted workspace — so in-container discovery tags it `org-only`.
 * `--ignore-conflicts` keeps the source-tracked boot org from prompting on a fresh, unrelated project.
 */
const deployOrgOnlyClassFromHost = async (className: string): Promise<void> => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'in-workspace-filter-'));
  const projectDir = path.join(tmpRoot, 'org-only-project');
  const classesDir = path.join(projectDir, 'force-app', 'main', 'default', 'classes');
  await fs.mkdir(classesDir, { recursive: true });
  await fs.writeFile(
    path.join(projectDir, 'sfdx-project.json'),
    JSON.stringify(
      {
        packageDirectories: [{ path: 'force-app', default: true }],
        namespace: '',
        sfdcLoginUrl: 'https://login.salesforce.com',
        sourceApiVersion: '64.0'
      },
      null,
      2
    )
  );
  await fs.writeFile(path.join(classesDir, `${className}.cls`), makeClass(className));
  await fs.writeFile(path.join(classesDir, `${className}.cls-meta.xml`), APEX_CLASS_META);
  await execAsync(
    `sf project deploy start --source-dir force-app --target-org ${MINIMAL_ORG_ALIAS} --ignore-conflicts --json`,
    { cwd: projectDir, env }
  );
  await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
};

/** Best-effort removal of a class from the shared boot org, so deployed classes don't accumulate. */
const deleteClassFromOrg = async (className: string): Promise<void> => {
  await execAsync(
    `sf project delete source --metadata ApexClass:${className} --target-org ${MINIMAL_ORG_ALIAS} --no-prompt --json`,
    { env }
  ).catch(() => {});
};

// Shared persistent workbench: reset editor + notification state before each test.
test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('Apex @in-workspace filter (Code Builder): shows local classes and hides org-only classes', async ({ page }) => {
  test.setTimeout(TEST_RUN_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // The boot org is authed on the host in the Code Builder CI (createMinimalOrg). Skip — never
  // false-fail — on a local run without that setup, since the host deploy below can't target it.
  const bootOrgAuthed = await execAsync(`sf org display -o ${MINIMAL_ORG_ALIAS} --json`, { env })
    .then(() => true)
    .catch(() => false);
  test.skip(!bootOrgAuthed, `boot org "${MINIMAL_ORG_ALIAS}" must be authed on the host to deploy the classes`);

  const stamp = Date.now();
  const workspaceClassName = `InWorkspaceClass${stamp}`;
  const orgOnlyClassName = `OrgOnlyClass${stamp}`;

  try {
    await test.step('create + deploy an in-workspace class, and deploy an org-only class (host CLI)', async () => {
      await ensureSecondarySideBarHidden(page);
      // In-workspace class: written to the mounted workspace AND deployed -> presence 'both'.
      await createAndDeployApexTestClass(page, workspaceClassName, makeClass(workspaceClassName));
      // Org-only class: deployed to the boot org but never added to the workspace -> org-only.
      await deployOrgOnlyClassFromHost(orgOnlyClassName);
      await saveScreenshot(page, 'inWorkspaceFilter.container.setup.classes-deployed.png');
    });

    let panel: Awaited<ReturnType<typeof openTestExplorerAndDiscover>>;
    await test.step('discover both classes in the Test Explorer', async () => {
      // The created class left a preview editor open; close all editors so discovery is clean.
      await closeAllEditors(page);
      panel = await openTestExplorerAndDiscover(page);
      await expect(treeRow(panel, workspaceClassName).first()).toBeVisible({ timeout: 60_000 });
      await expect(treeRow(panel, orgOnlyClassName).first()).toBeVisible({ timeout: 60_000 });
      await saveScreenshot(page, 'inWorkspaceFilter.container.01-both-discovered.png');
    });

    await test.step('apply @in-workspace — local class visible, org-only class hidden', async () => {
      panel = page.locator(TEST_EXPLORER_PANEL);
      await expect(async () => {
        await clearFilter(page);
        await focusAndTypeInFilter(page, '@in-workspace');
        await expect(treeRow(panel, workspaceClassName).first()).toBeVisible({ timeout: 3000 });
        await expect(treeRow(panel, orgOnlyClassName).first()).toBeHidden({ timeout: 3000 });
      }).toPass({ timeout: 60_000 });
      await saveScreenshot(page, 'inWorkspaceFilter.container.02-filtered.png');
    });

    await test.step('clear filter — both classes visible again', async () => {
      await clearFilter(page);
      await expect(treeRow(panel, workspaceClassName).first()).toBeVisible({ timeout: 15_000 });
      await expect(treeRow(panel, orgOnlyClassName).first()).toBeVisible({ timeout: 15_000 });
      await saveScreenshot(page, 'inWorkspaceFilter.container.03-cleared.png');
    });
  } finally {
    await deleteClassFromOrg(workspaceClassName);
    await deleteClassFromOrg(orgOnlyClassName);
  }

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
