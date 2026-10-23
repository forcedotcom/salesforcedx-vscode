/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { expect } from '@playwright/test';
import {
  clickCodeLens,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  env,
  execAsync,
  isDesktop,
  ORG_METADATA_EDITOR,
  resetContainerWorkbench,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  setupNonTrackingOrgAndAuth,
  WORKBENCH,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';

// `workspaceDir` is typed on both branches (desktop: the real workspace; container: the host side of the
// fixture bind mount); the web run still collects this file but `test.skip` (below) never executes the body.
import { isContainer, sharedWorkspaceDirTest as test } from '../fixtures';
import { TEST_RUN_TIMEOUT } from '../constants';
import { deployApexTestClassesFromHost, isOrgAuthedOnHost, ORG_ALIAS } from '../helpers/hostDeploy';
import { messages } from '../../../src/messages/i18n';
import type { ToolingTestsPage } from '../../../src/testDiscovery/schemas';
import {
  TEST_EXPLORER_TREE_ITEM,
  findTestExplorerItem,
  openTestExplorerAndDiscover
} from '../helpers/testExplorerHelpers';

// "Org-only" = the class exists in the org but NOT in local source. The retrieve flow
// (testController.ts retrieveOrgOnlyClassFromUri -> MetadataRetrieveService.retrieve, then component resolution)
// only fires on the `sf-org-metadata:` document, which requires the
// Apex language client (no "browser" bundle), so desktop + container only. The class is deployed from
// the host CLI into a throwaway project and never added to the workspace, so it is org-only by
// construction.
const RETRIEVE_CODELENS = messages.apex_test_retrieve_org_only_class_codelens_text;

const getDiscoveredMethodPosition = async (className: string, methodName: string) => {
  const { stdout: orgDisplayJson } = await execAsync(`sf org display --target-org ${ORG_ALIAS} --json`, {
    env
  });
  const apiVersion = Number((JSON.parse(orgDisplayJson) as { result: { apiVersion: string } }).result.apiVersion);
  const query = apiVersion >= 68 ? 'testLevel=RunAllTestsInOrg' : 'showAllMethods=true';
  const restPath = `/services/data/v${apiVersion.toFixed(1)}/tooling/tests?${query}`;
  const { stdout: discoveryJson } = await execAsync(
    `sf api request rest ${JSON.stringify(restPath)} --target-org ${ORG_ALIAS} --json`,
    { env }
  );
  const page = (JSON.parse(discoveryJson) as { result: { body: ToolingTestsPage } }).result.body;
  const method = page.apexTestClasses
    .find(testClass => testClass.name === className)
    ?.testMethods.find(testMethod => testMethod.name === methodName);
  expect(method, `Test Discovery should return ${className}.${methodName}`).toBeDefined();
  return { line: method?.line ?? 1, column: method?.column ?? 1 };
};

// Shared persistent workbench: reset editor + notification state before each test.
test.beforeEach(async ({ page }) => {
  if (isContainer) {
    await resetContainerWorkbench(page);
  }
});

(isDesktop() || isContainer ? test : test.skip.bind(test))(
  'Org-only Apex class: retrieve via code lens opens the on-disk .cls',
  async ({ page, workspaceDir }) => {
    test.setTimeout(TEST_RUN_TIMEOUT);
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    const className = `OrgOnlyRetrieve${Date.now()}`;
    const methodName = 'retrievedFromOrg';
    const classesDir = path.join(workspaceDir, 'force-app', 'main', 'default', 'classes');
    const localClsPath = path.join(classesDir, `${className}.cls`);

    const discoveredMethodPosition =
      await test.step('deploy an org-only Apex test class from the host (never in the workspace)', async () => {
        if (!isContainer) {
          await setupNonTrackingOrgAndAuth(page);
        }
        // The container's boot org is authed on the host in the Code Builder CI. Skip — never false-fail —
        // on a local run without that setup, since the host deploy can't target it.
        const orgAuthedOnHost = await isOrgAuthedOnHost();
        test.skip(!orgAuthedOnHost, `org "${ORG_ALIAS}" must be authed on the host to deploy the org-only class`);

        await ensureSecondarySideBarHidden(page);
        await deployApexTestClassesFromHost([className], methodName);
        await saveScreenshot(page, 'setup.class-deployed.png');
        return getDiscoveredMethodPosition(className, methodName);
      });

    await test.step('discover and open the org-only class virtual doc', async () => {
      const panel = await openTestExplorerAndDiscover(page);
      const classItem = panel.locator(TEST_EXPLORER_TREE_ITEM).filter({ hasText: new RegExp(className, 'i') });
      await classItem.first().waitFor({ state: 'visible', timeout: 60_000 });
      // A single click only selects a row; it never opens the editor. Expand the class to reveal its
      // leaf method, then double-click the method row — only a leaf with a range triggers VS Code's
      // "go to test" navigation, which opens the method's catalog document (the one place
      // the retrieve code lens renders).
      const twistie = classItem.first().locator('.monaco-tl-twistie');
      await expect(twistie).toBeVisible({ timeout: 10_000 });
      // On the container's browser-served workbench the twistie glyph is a zero-size pseudo-element and
      // the row intercepts pointer events at its coordinates.
      await twistie.click({ force: isContainer });
      const methodItem = findTestExplorerItem(page, methodName);
      await methodItem.waitFor({ state: 'visible', timeout: 60_000 });
      await methodItem.dblclick();
      // Assert the virtual doc actually opened before clicking the code lens, so a broken
      // open-on-click wiring surfaces here instead of as an opaque codelens-not-found timeout.
      await expect(page.locator(ORG_METADATA_EDITOR).first()).toBeVisible({
        timeout: 60_000
      });
      await expect(page.locator(WORKBENCH).getByRole('button', { name: /Ln \d+, Col \d+/ })).toContainText(
        new RegExp(`Ln ${discoveredMethodPosition.line}, Col ${discoveredMethodPosition.column}`),
        { timeout: 10_000 }
      );
      await saveScreenshot(page, 'step.virtual-doc-opened.png');
    });

    await test.step('click the retrieve code lens and verify the .cls lands on disk', async () => {
      await clickCodeLens(page, RETRIEVE_CODELENS, { timeout: 180_000 });
      await saveScreenshot(page, 'step.retrieve-codelens-clicked.png');

      // SDR writes the retrieved class back to local source independent of `getRetrievedFileUri`,
      // so this only confirms the retrieve ran. The editor-open assertion below is what validates
      // `getRetrievedFileUri` returned a real URI end-to-end.
      await expect(async () => {
        await fs.access(localClsPath);
      }).toPass({ timeout: TEST_RUN_TIMEOUT });
      await saveScreenshot(page, 'step.retrieved-cls-on-disk.png');

      // The retrieved on-disk class opens in the editor (showTextDocument with the URI from
      // getRetrievedFileUri) — passes only if getRetrievedFileUri returned a valid URI.
      await expect(page.locator(`${EDITOR_WITH_URI}[data-uri$="${className}.cls"]`).first()).toBeVisible({
        timeout: 60_000
      });
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
