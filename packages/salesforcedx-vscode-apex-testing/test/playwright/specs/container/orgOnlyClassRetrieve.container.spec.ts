/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container port of orgOnlyClassRetrieve.headless.spec.ts. The web twin is desktop-only because
 * salesforcedx-vscode-apex has no browser bundle: the retrieve flow only fires on the
 * `sf-org-metadata:` virtual doc, which needs the Apex language client. The Code Builder image runs
 * the DESKTOP build in a Node host, so the Apex LSP is present and this path is exercisable.
 *
 * ORG: the BOOT org (minimalTestOrg, the source-tracking scratch org authed as the default
 * target-org). No second org / no org switching is needed. "Org-only" means the class exists in the
 * org but NOT in the workspace — a property of org-vs-workspace presence, independent of source
 * tracking. The desktop twin used a NON-tracking org only to dodge the "Override Conflicts and
 * Deploy" modal that source-tracked orgs surface when a UI deploy conflicts; we never hit that here
 * because the org-only class is deployed from the HOST CLI (see below), not through the extension.
 *
 * MAKING THE CLASS ORG-ONLY: the desktop twin deploys a class then `fs.rm`s the on-disk `.cls` +
 * `-meta.xml` to make it org-only. Container specs can't do that — the workspace is a bind mount
 * INSIDE the container and the host mount path is not exposed to specs (createContainerTest hands
 * over only a `page`). So instead of deploy-then-delete, we deploy the class to the boot org from the
 * HOST CLI into a throwaway project and NEVER add it to the mounted workspace: it is org-only by
 * construction. The in-container test discovery (Tooling API query of the default org, then
 * workspace resolution) tags it `org-only`, and the retrieve code lens renders on its virtual doc.
 *
 * Skips (never false-fails) when the boot org isn't authed on the host — i.e. a local run without the
 * Code Builder multi-org CI setup that creates and auths minimalTestOrg on the host.
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { expect } from '@playwright/test';
import {
  clickCodeLens,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  env,
  execAsync,
  MINIMAL_ORG_ALIAS,
  ORG_METADATA_EDITOR,
  resetContainerWorkbench,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  TEST_EXPLORER_TREE_ITEM,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';

import { containerTest as test } from '../../fixtures/containerFixtures';
import { TEST_RUN_TIMEOUT } from '../../constants';
import { findTestExplorerItem, openTestExplorerAndDiscover } from '../../helpers/testExplorerHelpers';
import { messages } from '../../../../src/messages/i18n';

const RETRIEVE_CODELENS = messages.apex_test_retrieve_org_only_class_codelens_text;

const APEX_CLASS_META = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">',
  '    <apiVersion>64.0</apiVersion>',
  '    <status>Active</status>',
  '</ApexClass>'
].join('\n');

const makeApexTestClass = (name: string, method: string): string =>
  [
    '@isTest',
    `public class ${name} {`,
    '\t@isTest',
    `\tstatic void ${method}() {`,
    `\t\tSystem.assertEquals(1, 1, '${name}');`,
    '\t}',
    '}'
  ].join('\n');

/**
 * Deploy an Apex test class to the boot org from the HOST CLI into a throwaway project, WITHOUT ever
 * adding it to the container's mounted workspace — so in-container discovery tags it `org-only`.
 * `--ignore-conflicts` keeps the source-tracked boot org from prompting on a fresh, unrelated project.
 */
const deployOrgOnlyClassFromHost = async (className: string, methodName: string): Promise<void> => {
  const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'org-only-retrieve-'));
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
  await fs.writeFile(path.join(classesDir, `${className}.cls`), makeApexTestClass(className, methodName));
  await fs.writeFile(path.join(classesDir, `${className}.cls-meta.xml`), APEX_CLASS_META);
  await execAsync(
    `sf project deploy start --source-dir force-app --target-org ${MINIMAL_ORG_ALIAS} --ignore-conflicts --json`,
    { cwd: projectDir, env }
  );
  await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
};

// No org cleanup: the boot org is a per-CI-run scratch org deleted at job teardown, and the class name
// is uniquely stamped so it never collides on a locally-reused org. (A prior `sf project delete source`
// here was a no-op anyway — it ran outside any SFDX project dir and failed before touching the org.)

// Shared persistent workbench: reset editor + notification state before each test.
test.beforeEach(async ({ page }) => {
  await resetContainerWorkbench(page);
});

test('Org-only Apex class (Code Builder): retrieve via code lens opens the on-disk .cls', async ({ page }) => {
  test.setTimeout(TEST_RUN_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // The boot org is authed on the host in the Code Builder CI (createMinimalOrg). Skip — never
  // false-fail — on a local run without that setup, since the host deploy below can't target it.
  const bootOrgAuthed = await execAsync(`sf org display -o ${MINIMAL_ORG_ALIAS} --json`, { env })
    .then(() => true)
    .catch(() => false);
  test.skip(!bootOrgAuthed, `boot org "${MINIMAL_ORG_ALIAS}" must be authed on the host to deploy the org-only class`);

  const className = `OrgOnlyRetrieve${Date.now()}`;
  const methodName = 'retrievedFromOrg';

  await test.step('deploy an org-only Apex test class to the boot org (host CLI, not in workspace)', async () => {
    await ensureSecondarySideBarHidden(page);
    await deployOrgOnlyClassFromHost(className, methodName);
    await saveScreenshot(page, 'orgOnlyRetrieve.container.setup.org-only-deployed.png');
  });

  await test.step('discover and open the org-only class virtual doc', async () => {
    // Discovery (Tooling API query of the default org) surfaces the class; it resolves to no
    // workspace file, so it is tagged org-only and its method navigates to the catalog document.
    const panel = await openTestExplorerAndDiscover(page);
    const classItem = panel.locator(TEST_EXPLORER_TREE_ITEM).filter({ hasText: new RegExp(className, 'i') });
    await classItem.first().waitFor({ state: 'visible', timeout: 60_000 });
    // Expand the class to reveal its leaf method, then double-click it — only a leaf with a range
    // triggers VS Code's "go to test" navigation, which opens the sf-org-metadata virtual doc (the
    // one place the retrieve code lens renders).
    await classItem.first().locator('.monaco-tl-twistie').click({ force: true });
    const methodItem = findTestExplorerItem(page, methodName);
    await methodItem.waitFor({ state: 'visible', timeout: 60_000 });
    await methodItem.dblclick();
    // Assert the virtual doc actually opened before clicking the code lens, so a broken
    // open-on-click wiring surfaces here instead of as an opaque codelens-not-found timeout.
    await expect(page.locator(ORG_METADATA_EDITOR).first()).toBeVisible({ timeout: 60_000 });
    await saveScreenshot(page, 'orgOnlyRetrieve.container.01-virtual-doc-opened.png');
  });

  await test.step('click the retrieve code lens and verify the retrieved .cls opens', async () => {
    await clickCodeLens(page, RETRIEVE_CODELENS, { timeout: 180_000 });
    await saveScreenshot(page, 'orgOnlyRetrieve.container.02-retrieve-clicked.png');

    // The retrieved on-disk class opens in the editor (showTextDocument with the URI from
    // getRetrievedFileUri) — passes only if getRetrievedFileUri returned a valid URI end-to-end.
    // (Unlike the desktop twin we assert via the editor rather than host fs.access: the retrieve
    // writes into the container's mounted workspace, whose host path specs don't have.)
    await expect(page.locator(`${EDITOR_WITH_URI}[data-uri$="${className}.cls"]`).first()).toBeVisible({
      timeout: 60_000
    });
    await saveScreenshot(page, 'orgOnlyRetrieve.container.03-retrieved-cls-open.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
