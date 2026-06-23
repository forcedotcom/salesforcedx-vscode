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
  closeAllEditors,
  createAndDeployApexTestClass,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  isDesktop,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  setupNonTrackingOrgAndAuth,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';

// Import the desktop fixture directly (not the web/desktop union from `../fixtures`) so
// `workspaceDir` is typed; the web run still collects this file but `test.skip` (below) never
// executes the desktop-only body.
import { desktopTest as test } from '../fixtures/desktopFixtures';
import { TEST_RUN_TIMEOUT } from '../constants';
import { messages } from '../../../src/messages/i18n';
import {
  TEST_EXPLORER_TREE_ITEM,
  findTestExplorerItem,
  openTestExplorerAndDiscover
} from '../helpers/testExplorerHelpers';

// "Org-only" = the class exists in the org but NOT in local source. The retrieve flow
// (testController.ts retrieveOrgOnlyClassFromUri -> MetadataRetrieveService.retrieve ->
// getRetrievedFileUri) only fires on the `apex-testing:` virtual doc, which requires the
// Apex language client (no "browser" bundle). Desktop only — `workspaceDir` (real disk) is
// also needed to make the class org-only and to assert the retrieved `.cls` lands on disk.
const RETRIEVE_CODELENS = messages.apex_test_retrieve_org_only_class_codelens_text;

(isDesktop() ? test : test.skip.bind(test))(
  'Org-only Apex class: retrieve via code lens opens the on-disk .cls',
  async ({ page, workspaceDir }) => {
    test.setTimeout(TEST_RUN_TIMEOUT);
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    const className = `OrgOnlyRetrieve${Date.now()}`;
    const classContent = `@isTest
public class ${className} {
    @isTest
    static void retrievedFromOrg() {
        System.assertEquals(1, 1, 'org-only retrieve should pass');
    }
}`;
    const classesDir = path.join(workspaceDir, 'force-app', 'main', 'default', 'classes');
    const localClsPath = path.join(classesDir, `${className}.cls`);

    await test.step('setup non-tracking org and deploy an Apex test class', async () => {
      await setupNonTrackingOrgAndAuth(page);
      await ensureSecondarySideBarHidden(page);
      await createAndDeployApexTestClass(page, className, classContent);
      await saveScreenshot(page, 'setup.class-deployed.png');
    });

    await test.step('delete local source so the class is org-only', async () => {
      // Remove both the `.cls` and its `-meta.xml` from disk (not from the org). After this the
      // class is in the org but absent from local source, so discovery tags it `org-only`.
      await fs.rm(localClsPath, { force: true });
      await fs.rm(`${localClsPath}-meta.xml`, { force: true });
      await expect(async () => {
        await expect(fs.access(localClsPath)).rejects.toThrow();
      }).toPass({ timeout: 10_000 });
      await saveScreenshot(page, 'setup.local-source-removed.png');
    });

    await test.step('discover and open the org-only class virtual doc', async () => {
      // `createApexClass` (setup) left the on-disk `.cls` open in a preview editor; deleting the
      // file does not close that tab. A leftover active editor keeps the test-item click from
      // navigating to the `apex-testing:` virtual doc, so close all editors first.
      await closeAllEditors(page);
      const panel = await openTestExplorerAndDiscover(page);
      const classItem = panel.locator(TEST_EXPLORER_TREE_ITEM).filter({ hasText: new RegExp(className, 'i') });
      await classItem.first().waitFor({ state: 'visible', timeout: 60_000 });
      // A single click only selects a row; it never opens the editor. Expand the class to reveal its
      // leaf method, then double-click the method row — only a leaf with a range triggers VS Code's
      // "go to test" navigation, which opens the method's `apex-testing:` virtual doc (the one place
      // the retrieve code lens renders).
      await classItem.first().locator('.monaco-tl-twistie').click({ force: true });
      const methodItem = findTestExplorerItem(page, 'retrievedFromOrg');
      await methodItem.waitFor({ state: 'visible', timeout: 60_000 });
      await methodItem.dblclick();
      // Assert the virtual doc actually opened before clicking the code lens, so a broken
      // open-on-click wiring surfaces here instead of as an opaque codelens-not-found timeout.
      await expect(page.locator(`${EDITOR_WITH_URI}[data-uri^="apex-testing:"]`).first()).toBeVisible({
        timeout: 60_000
      });
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
