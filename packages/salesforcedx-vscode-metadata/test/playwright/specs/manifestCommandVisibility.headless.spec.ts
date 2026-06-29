/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  createMinimalOrg,
  EDITOR,
  ensureSecondarySideBarHidden,
  isDesktop,
  openFileByName,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  upsertScratchOrgAuthFieldsToSettings,
  validateNoCriticalErrors,
  verifyCommandDoesNotExist,
  verifyCommandExists,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import packageNls from '../../../package.nls.json';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import { desktopTest as test } from '../fixtures';

// A *Package.xml file outside manifest/ must still get the forcesourcemanifest language
// (filenamePatterns "**/*[Pp]ackage.xml"), so the in-manifest deploy/retrieve menus appear.
// A plain *.xml file must NOT match, guarding against an over-broad pattern.
const MANIFEST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>*</members>
    <name>ApexClass</name>
  </types>
  <version>62.0</version>
</Package>`;

const PLAIN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<root></root>`;

(isDesktop() ? test : test.skip.bind(test))(
  'Manifest command visibility: *Package.xml shows in-manifest commands, plain xml does not',
  async ({ page, workspaceDir }) => {
    test.setTimeout(180_000);
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    await test.step('setup minimal org', async () => {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);

      // in-manifest when-clauses gate on sf:has_target_org; wait for org to be active
      const statusBarPage = new SourceTrackingStatusBarPage(page);
      await statusBarPage.waitForVisible(120_000);
    });

    await test.step('*Package.xml outside manifest/ shows in-manifest commands', async () => {
      // workspace root is outside any manifest/ dir and outside package directories (force-app)
      await fs.writeFile(path.join(workspaceDir, 'sfdxPackage.xml'), MANIFEST_XML);

      await openFileByName(page, 'sfdxPackage.xml');
      await expect(
        page.locator(`${EDITOR}[data-uri*="sfdxPackage.xml"]`).first(),
        'sfdxPackage.xml should be the active editor'
      ).toBeVisible({ timeout: 15_000 });

      await verifyCommandExists(page, packageNls.deploy_in_manifest_text);
      await verifyCommandExists(page, packageNls.retrieve_in_manifest_text);
    });

    // guards only the basename suffix: a plain .xml file is not matched. It does not
    // exercise a *Package.xml file inside a package dir (that case is covered by the
    // boundary rationale in the plan: no real metadata source file ends in *Package.xml).
    await test.step('plain xml does not match the *Package.xml suffix', async () => {
      await fs.writeFile(path.join(workspaceDir, 'foo.xml'), PLAIN_XML);

      await openFileByName(page, 'foo.xml');
      await expect(
        page.locator(`${EDITOR}[data-uri*="foo.xml"]`).first(),
        'foo.xml should be the active editor'
      ).toBeVisible({ timeout: 15_000 });

      await verifyCommandDoesNotExist(page, packageNls.deploy_in_manifest_text);
      await verifyCommandDoesNotExist(page, packageNls.retrieve_in_manifest_text);
    });

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
