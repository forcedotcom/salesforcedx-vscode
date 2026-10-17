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
 * Desktop and container reach the same on-disk end state through two structurally different
 * mechanisms, so this file registers two different tests gated on environment rather than branching
 * inside one body: desktop stages files via the `workspaceDir` fixture (a fresh temp workspace,
 * real disk, typed only on the desktop TestType); the container instead writes directly into
 * CB_FIXTURE_HOST_DIR, the host side of the container's bind mount, since there is no per-run
 * workspace fixture for the container's shared, persistent workbench. Because `workspaceDir` is not a
 * fixture on the container/web TestTypes, unifying both into a single `sharedTest`-based test body
 * would not type-check — hence the module-level branch below.
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
import { isContainer, desktopTest } from '../fixtures';
import { containerTest } from '../fixtures/containerFixtures';

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

if (isContainer) {
  /*
   * The host side of the bind mount, published by the orchestrator (scripts/codeBuilderLocalE2E.ts). A
   * host-side node:fs write here lands in the container's opened folder through the mount, so the files
   * become part of the workspace code-server has open. Resolved once at load; a missing var is a
   * wiring bug (the orchestrator always sets it), so fail loud rather than write to a guessed path.
   */
  const fixtureHostDir = process.env.CB_FIXTURE_HOST_DIR;

  // Unique per run so the shared, persistent workbench never sees a leftover file from a prior run. The
  // unique token goes BEFORE "Package.xml"/".xml" so the manifest file still ends with "Package.xml"
  // (the pattern the language association matches on).
  const stamp = Date.now();
  const manifestFileName = `sfdx${stamp}Package.xml`;
  const plainFileName = `foo${stamp}.xml`;

  const createdFiles: string[] = [];

  containerTest.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });

  containerTest.afterEach(async () => {
    // Remove any files this spec wrote into the shared fixture so the workspace shape is left as found.
    await Promise.all(createdFiles.splice(0).map(file => fs.rm(file, { force: true })));
  });

  containerTest(
    'Manifest command visibility (Code Builder): *Package.xml shows in-manifest commands, plain xml does not',
    async ({ page }) => {
      containerTest.setTimeout(180_000);
      const consoleErrors = setupConsoleMonitoring(page);
      const networkErrors = setupNetworkMonitoring(page);

      if (!fixtureHostDir) {
        throw new Error(
          'CB_FIXTURE_HOST_DIR is not set — the orchestrator (scripts/codeBuilderLocalE2E.ts) must publish the ' +
            'host side of the fixture bind mount so this spec can write files into the opened workspace.'
        );
      }

      const manifestPath = path.join(fixtureHostDir, manifestFileName);
      const plainPath = path.join(fixtureHostDir, plainFileName);

      await containerTest.step('workbench ready + stage both fixture files', async () => {
        // The containerTest fixture already awaited workbench readiness before handing over `page`.
        await closeWelcomeTabs(page);
        await ensureSecondarySideBarHidden(page);

        // Write BOTH files at the project root (outside any manifest/ dir and outside the package
        // directories) BEFORE the first Quick Open. VS Code builds its Go-to-File index lazily on first
        // use and refreshes it from a file watcher that can miss host-side writes to a bind mount on some
        // platforms (macOS Docker); staging both up front guarantees both are in that first index build,
        // so each openFileByName below resolves regardless of watcher behavior.
        createdFiles.push(manifestPath, plainPath);
        await fs.writeFile(manifestPath, MANIFEST_XML);
        await fs.writeFile(plainPath, PLAIN_XML);
        await saveScreenshot(page, 'manifestCommandVisibility.container.01-ready.png');
      });

      await containerTest.step('*Package.xml outside manifest/ shows in-manifest commands', async () => {
        await openFileByName(page, manifestFileName);
        await expect(
          page.locator(`${EDITOR}[data-uri*="${manifestFileName}"]`).first(),
          `${manifestFileName} should be the active editor`
        ).toBeVisible({ timeout: 15_000 });
        await saveScreenshot(page, 'manifestCommandVisibility.container.02-manifest-open.png');

        // The in-manifest when-clauses also gate on sf:has_target_org; the generous timeout rides out the
        // brief window while the ambient boot org's context propagates into the workbench.
        await verifyCommandExists(page, packageNls.deploy_in_manifest_text, 60_000);
        await verifyCommandExists(page, packageNls.retrieve_in_manifest_text, 60_000);
      });

      await containerTest.step('plain xml does not match the *Package.xml suffix', async () => {
        await openFileByName(page, plainFileName);
        await expect(
          page.locator(`${EDITOR}[data-uri*="${plainFileName}"]`).first(),
          `${plainFileName} should be the active editor`
        ).toBeVisible({ timeout: 15_000 });
        await saveScreenshot(page, 'manifestCommandVisibility.container.03-plain-open.png');

        await verifyCommandDoesNotExist(page, packageNls.deploy_in_manifest_text);
        await verifyCommandDoesNotExist(page, packageNls.retrieve_in_manifest_text);
      });

      await validateNoCriticalErrors(containerTest, consoleErrors, networkErrors);
    }
  );
} else {
  (isDesktop() ? desktopTest : desktopTest.skip.bind(desktopTest))(
    'Manifest command visibility: *Package.xml shows in-manifest commands, plain xml does not',
    async ({ page, workspaceDir }) => {
      desktopTest.setTimeout(180_000);
      const consoleErrors = setupConsoleMonitoring(page);
      const networkErrors = setupNetworkMonitoring(page);

      await desktopTest.step('setup minimal org', async () => {
        const createResult = await createMinimalOrg();
        await waitForVSCodeWorkbench(page);
        await closeWelcomeTabs(page);
        await ensureSecondarySideBarHidden(page);
        await upsertScratchOrgAuthFieldsToSettings(page, createResult);

        // in-manifest when-clauses gate on sf:has_target_org; wait for org to be active
        const statusBarPage = new SourceTrackingStatusBarPage(page);
        await statusBarPage.waitForVisible(120_000);
      });

      await desktopTest.step('*Package.xml outside manifest/ shows in-manifest commands', async () => {
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
      await desktopTest.step('plain xml does not match the *Package.xml suffix', async () => {
        await fs.writeFile(path.join(workspaceDir, 'foo.xml'), PLAIN_XML);

        await openFileByName(page, 'foo.xml');
        await expect(
          page.locator(`${EDITOR}[data-uri*="foo.xml"]`).first(),
          'foo.xml should be the active editor'
        ).toBeVisible({ timeout: 15_000 });

        await verifyCommandDoesNotExist(page, packageNls.deploy_in_manifest_text);
        await verifyCommandDoesNotExist(page, packageNls.retrieve_in_manifest_text);
      });

      await validateNoCriticalErrors(desktopTest, consoleErrors, networkErrors);
    }
  );
}
