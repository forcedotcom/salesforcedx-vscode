/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers manifest command visibility: the forcesourcemanifest language pattern
 * ("**\/*[Pp]ackage.xml") surfaces the in-manifest deploy/retrieve commands for a *Package.xml file
 * OUTSIDE manifest/ and does NOT surface them for a plain .xml file.
 *
 * The files are written from the host into the open project (`workspaceDir`: desktop's fresh temp
 * workspace, or the container's fixture bind mount) and removed after the test.
 *
 * Container: runs against the container's boot-authed org instead of a freshly created minimal org,
 * with uniquely named files so the shared, persistent workbench never sees a prior run's leftovers.
 */

import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  createMinimalOrg,
  EDITOR,
  ensureSecondarySideBarHidden,
  isDesktop,
  openFileByName,
  resetContainerWorkbench,
  saveScreenshot,
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
import { isContainer, sharedWorkspaceDirTest as test } from '../fixtures';

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

// Desktop and Code Builder only: web has no host-side project folder to write into.
test.skip(!isContainer && !isDesktop(), 'Writes files into the project from the host (desktop and Code Builder only)');

// Files this test wrote into the project, removed after it (pass or fail). On the container this keeps
// the shared workbench as found; on desktop the temp workspace is discarded anyway.
const createdFiles: string[] = [];

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
}
test.afterEach(async () => {
  await Promise.all(createdFiles.splice(0).map(file => fs.rm(file, { force: true })));
});

test('Manifest command visibility: *Package.xml shows in-manifest commands, plain xml does not', async ({
  page,
  workspaceDir
}) => {
  test.setTimeout(180_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Unique per run so the container's shared, persistent workbench never sees a leftover file from a prior
  // run. The unique token goes BEFORE "Package.xml"/".xml" so the manifest file still ends with
  // "Package.xml" (the pattern the language association matches on).
  const stamp = Date.now();
  const manifestFileName = `sfdx${stamp}Package.xml`;
  const plainFileName = `foo${stamp}.xml`;

  await test.step('setup + stage both files', async () => {
    // The container's fixture already awaited the workbench, and its boot org is already authed.
    const createResult = isContainer ? undefined : await createMinimalOrg();
    if (!isContainer) {
      await waitForVSCodeWorkbench(page);
    }
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    if (createResult) {
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
    }

    // in-manifest when-clauses gate on sf:has_target_org; wait for org to be active
    const statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);

    // Write BOTH files at the project root (outside any manifest/ dir and outside the package
    // directories) BEFORE the first Quick Open. VS Code builds its Go-to-File index lazily on first
    // use and refreshes it from a file watcher that can miss host-side writes to a bind mount on some
    // platforms (macOS Docker); staging both up front puts both in that first index build, so each
    // openFileByName below resolves regardless of watcher behavior.
    const manifestPath = path.join(workspaceDir, manifestFileName);
    const plainPath = path.join(workspaceDir, plainFileName);
    createdFiles.push(manifestPath, plainPath);
    await fs.writeFile(manifestPath, MANIFEST_XML);
    await fs.writeFile(plainPath, PLAIN_XML);
    await saveScreenshot(page, 'manifestCommandVisibility.01-ready.png');
  });

  await test.step('*Package.xml outside manifest/ shows in-manifest commands', async () => {
    await openFileByName(page, manifestFileName);
    await expect(
      page.locator(`${EDITOR}[data-uri*="${manifestFileName}"]`).first(),
      `${manifestFileName} should be the active editor`
    ).toBeVisible({ timeout: 15_000 });
    await saveScreenshot(page, 'manifestCommandVisibility.02-manifest-open.png');

    // The generous timeout rides out the brief window while the org's context propagates into the
    // workbench after the status bar appears.
    await verifyCommandExists(page, packageNls.deploy_in_manifest_text, 60_000);
    await verifyCommandExists(page, packageNls.retrieve_in_manifest_text, 60_000);
  });

  // guards only the basename suffix: a plain .xml file is not matched. It does not
  // exercise a *Package.xml file inside a package dir (that case is covered by the
  // boundary rationale in the plan: no real metadata source file ends in *Package.xml).
  await test.step('plain xml does not match the *Package.xml suffix', async () => {
    await openFileByName(page, plainFileName);
    await expect(
      page.locator(`${EDITOR}[data-uri*="${plainFileName}"]`).first(),
      `${plainFileName} should be the active editor`
    ).toBeVisible({ timeout: 15_000 });
    await saveScreenshot(page, 'manifestCommandVisibility.03-plain-open.png');

    await verifyCommandDoesNotExist(page, packageNls.deploy_in_manifest_text);
    await verifyCommandDoesNotExist(page, packageNls.retrieve_in_manifest_text);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
