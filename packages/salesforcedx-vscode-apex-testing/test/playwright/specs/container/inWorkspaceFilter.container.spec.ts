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
 * dodge the source-tracked "Override Conflicts and Deploy" UI-deploy modal; here nothing deploys
 * through the extension, so that modal is never in play.)
 *
 * TWO CLASSES — both put in the org by ONE host-CLI deploy (no extension round-trip, no on-disk edit):
 *   - in-workspace: the SEEDED `PagedResultTest` (already on disk in the mounted fixture workspace).
 *     Deploying it to the boot org makes its presence 'both' -> `in-workspace`. We deploy the exact
 *     seeded source (mirrored below) so this is self-contained and does not depend on a sibling spec
 *     having deployed it first, and is byte-identical to what those specs deploy (no interference).
 *   - org-only: a fresh uniquely-named class deployed alongside it but NEVER added to the workspace
 *     -> presence org-only -> `org-only`. (The desktop twin instead deploys then `fs.rm`s the on-disk
 *     file; container specs can't, because the workspace is a bind mount inside the container whose
 *     host path is not exposed to specs.)
 *
 * COST: this collapses the prior two deploys (an extension UI create-and-deploy for the in-workspace
 * class + a host deploy for the org-only class) into a SINGLE `sf project deploy start`, which is the
 * bulk of the spec's runtime — it keeps the apex-testing container suite inside its CI job timeout.
 *
 * Skips (never false-fails) when the boot org isn't authed on the host — i.e. a local run without the
 * Code Builder multi-org CI setup that creates and auths minimalTestOrg on the host.
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { expect, type Locator } from '@playwright/test';
import {
  clearFilter,
  ensureSecondarySideBarHidden,
  env,
  execAsync,
  focusAndTypeInFilter,
  MINIMAL_ORG_ALIAS,
  resetContainerWorkbench,
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

// The in-workspace class we assert on is the seeded PagedResultTest — it already exists on disk in the
// mounted fixture workspace, so once it is in the org its presence is 'both' -> `in-workspace`.
const WORKSPACE_TEST_CLASS = 'PagedResultTest';

// Exact mirror of the seeded fixture sources (container-workspace/.../classes). Deploying byte-identical
// source keeps this spec self-contained AND non-interfering with sibling specs that deploy the same
// classes. PagedResultTest depends on PagedResult, so both go in the deploy.
const PAGED_RESULT = [
  'public with sharing class PagedResult {',
  '    @AuraEnabled',
  '    public Integer pageSize { get; set; }',
  '',
  '    @AuraEnabled',
  '    public Integer pageNumber { get; set; }',
  '',
  '    @AuraEnabled',
  '    public Integer totalItemCount { get; set; }',
  '',
  '    @AuraEnabled',
  '    public Object[] records { get; set; }',
  '}'
].join('\n');

const PAGED_RESULT_TEST = [
  '@isTest',
  'private class PagedResultTest {',
  '    @isTest',
  '    static void holdsPageMetadata() {',
  '        PagedResult result = new PagedResult();',
  '        result.pageSize = 10;',
  '        result.pageNumber = 1;',
  '        result.totalItemCount = 42;',
  '        result.records = new List<Object>();',
  '',
  "        System.assertEquals(10, result.pageSize, 'pageSize round-trips');",
  "        System.assertEquals(1, result.pageNumber, 'pageNumber round-trips');",
  "        System.assertEquals(42, result.totalItemCount, 'totalItemCount round-trips');",
  "        System.assertEquals(0, result.records.size(), 'records starts empty');",
  '    }',
  '}'
].join('\n');

const makeOrgOnlyClass = (name: string): string =>
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
 * ONE host-CLI deploy that puts BOTH classes in the boot org: the seeded PagedResult + PagedResultTest
 * (also on disk in the workspace -> presence 'both'), and a fresh org-only class NEVER added to the
 * workspace -> presence org-only.
 * `--ignore-conflicts` keeps the source-tracked boot org from prompting on a fresh, unrelated project.
 */
const deployWorkspaceAndOrgOnlyClasses = async (orgOnlyClassName: string): Promise<void> => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'in-workspace-filter-'));
  const projectDir = path.join(tmpRoot, 'filter-project');
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
  const write = async (name: string, body: string): Promise<void> => {
    await fs.writeFile(path.join(classesDir, `${name}.cls`), body);
    await fs.writeFile(path.join(classesDir, `${name}.cls-meta.xml`), APEX_CLASS_META);
  };
  await write('PagedResult', PAGED_RESULT);
  await write(WORKSPACE_TEST_CLASS, PAGED_RESULT_TEST);
  await write(orgOnlyClassName, makeOrgOnlyClass(orgOnlyClassName));
  await execAsync(
    `sf project deploy start --source-dir force-app --target-org ${MINIMAL_ORG_ALIAS} --ignore-conflicts --json`,
    { cwd: projectDir, env }
  );
  await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
};

// No org cleanup: the boot org is a per-CI-run scratch org deleted at job teardown, the org-only class
// name is uniquely stamped (no collision on a locally-reused org), and PagedResult/PagedResultTest are
// seeded classes sibling specs deploy too. (A prior `sf project delete source` here was a no-op anyway —
// it ran outside any SFDX project dir and failed before touching the org.)

// Shared persistent workbench: reset editor + notification state before each test.
test.beforeEach(async ({ page }) => {
  await resetContainerWorkbench(page);
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

  const orgOnlyClassName = `OrgOnlyClass${Date.now()}`;

  await test.step('deploy the in-workspace + org-only classes to the boot org (single host CLI deploy)', async () => {
    await ensureSecondarySideBarHidden(page);
    await deployWorkspaceAndOrgOnlyClasses(orgOnlyClassName);
    await saveScreenshot(page, 'inWorkspaceFilter.container.setup.classes-deployed.png');
  });

  let panel: Awaited<ReturnType<typeof openTestExplorerAndDiscover>>;
  await test.step('discover both classes in the Test Explorer', async () => {
    panel = await openTestExplorerAndDiscover(page);
    await expect(treeRow(panel, WORKSPACE_TEST_CLASS).first()).toBeVisible({ timeout: 60_000 });
    await expect(treeRow(panel, orgOnlyClassName).first()).toBeVisible({ timeout: 60_000 });
    await saveScreenshot(page, 'inWorkspaceFilter.container.01-both-discovered.png');
  });

  await test.step('apply @in-workspace — local class visible, org-only class hidden', async () => {
    panel = page.locator(TEST_EXPLORER_PANEL);
    await expect(async () => {
      await clearFilter(page);
      await focusAndTypeInFilter(page, '@in-workspace');
      await expect(treeRow(panel, WORKSPACE_TEST_CLASS).first()).toBeVisible({ timeout: 3000 });
      await expect(treeRow(panel, orgOnlyClassName).first()).toBeHidden({ timeout: 3000 });
    }).toPass({ timeout: 60_000 });
    await saveScreenshot(page, 'inWorkspaceFilter.container.02-filtered.png');
  });

  await test.step('clear filter — both classes visible again', async () => {
    await clearFilter(page);
    await expect(treeRow(panel, WORKSPACE_TEST_CLASS).first()).toBeVisible({ timeout: 15_000 });
    await expect(treeRow(panel, orgOnlyClassName).first()).toBeVisible({ timeout: 15_000 });
    await saveScreenshot(page, 'inWorkspaceFilter.container.03-cleared.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
