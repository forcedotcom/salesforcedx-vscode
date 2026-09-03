/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the sfdx-project.json cache-invalidation fix. The web twin
 * (retrieveStaleApiVersion.headless.spec.ts) proves the FileSystemWatcher -> FileChangePubSub ->
 * invalidateSfProjectCache pipeline on a plain Page against web memfs; this proves the same pipeline in
 * the Code Builder image (desktop build, file:// fs, Node host).
 *
 * The scenario is entirely local (editor edits + manifest generation), so it does not touch the org — it
 * runs against the container's boot workspace. It edits sfdx-project.json THROUGH the editor and reads the
 * generated manifest FROM the editor (never Node fs), and restores sfdx-project.json to the fixture
 * baseline afterward so the shared persistent workbench is left as found.
 */

import {
  activeQuickInputTextField,
  activeQuickInputWidget,
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  createApexClass,
  DIRTY_EDITOR,
  disableMonacoAutoClosing,
  EDITOR,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  focusOnFilesExplorer,
  openFileByName,
  openFileFromExplorerTree,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import { expect, type Page } from '@playwright/test';
import { messages } from '../../../../src/messages/i18n';
import packageNls from '../../../../package.nls.json';
import { RETRIEVE_TIMEOUT } from '../../../constants';
import { containerTest as test } from '../../fixtures/containerFixtures';

// Two distinct non-default values; the warm step pins the first so the test is independent of the
// container fixture default (64.0). BASELINE_API_VERSION restores the fixture on the way out.
const WARM_API_VERSION = '63.0';
const EDITED_API_VERSION = '62.0';
const BASELINE_API_VERSION = '64.0';

/**
 * sfdx-project.json body with a given sourceApiVersion; single-line so it types in one keystroke run
 * with no editor auto-indent. The downstream assertion matches the `sourceApiVersion` substring, so
 * whitespace/formatting is irrelevant.
 */
const projectJson = (sourceApiVersion: string): string =>
  JSON.stringify({
    packageDirectories: [{ path: 'force-app', default: true }],
    namespace: '',
    sfdcLoginUrl: 'https://login.salesforce.com',
    sourceApiVersion
  });

/** Open sfdx-project.json from the Explorer and overwrite its full contents with `sourceApiVersion`, then save. */
const writeProjectApiVersion = async (page: Page, sourceApiVersion: string) => {
  await focusOnFilesExplorer(page);
  await page.keyboard.press('End');
  await openFileFromExplorerTree(page, 'sfdx-project.json');

  const editor = page.locator(`${EDITOR}[data-uri$="sfdx-project.json"]`).first();
  await editor.waitFor({ state: 'visible', timeout: 10_000 });
  await editor.locator('.view-line').first().waitFor({ state: 'visible', timeout: 5000 });
  await editor.click();

  // Select-all via command palette (keyboard shortcut can miss on web), then type the new contents.
  // No clipboard: it is a shared global resource and parallel workers race on it. disableMonacoAutoClosing
  // stops `{`/`[`/`"` from doubling.
  await disableMonacoAutoClosing(page);
  await editor.click();
  await executeCommandWithCommandPalette(page, 'Select All');
  await page.keyboard.press('Delete');
  await page.keyboard.type(projectJson(sourceApiVersion));

  await expect(editor.locator('.view-lines'), 'edited sfdx-project.json buffer').toContainText(
    `"sourceApiVersion":"${sourceApiVersion}"`
  );

  await executeCommandWithCommandPalette(page, 'File: Save');
  await expect(page.locator(DIRTY_EDITOR).first()).not.toBeVisible({ timeout: 10_000 });
};

/** Generate a manifest from the active editor into `manifest/<fileName>` and return the manifest editor locator. */
const generateManifest = async (page: Page, fileName: string) => {
  await executeCommandWithCommandPalette(page, packageNls.project_generate_manifest_text);

  const quickInput = activeQuickInputWidget(page);
  await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
  await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'attached', timeout: 10_000 });

  await activeQuickInputTextField(page).fill(fileName.replace(/\.xml$/i, ''));
  await page.keyboard.press('Enter');

  const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${fileName}"]`).first();
  await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
  return manifestEditor;
};

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('manifest version tracks mid-session sourceApiVersion edit without reload (Code Builder)', async ({ page }) => {
  test.setTimeout(RETRIEVE_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const ts = Date.now();
  const className = `StaleApiVersion${ts}`;
  // Per-run manifest names avoid the overwrite modal / collisions in the shared persistent workbench.
  const warmManifestFile = `pkgWarm${ts}.xml`;
  const freshManifestFile = `pkgFresh${ts}.xml`;

  await test.step('workbench ready', async () => {
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await verifyCommandExists(page, packageNls.project_generate_manifest_text, 60_000);
    await saveScreenshot(page, 'retrieveStaleApiVersion.container.01-ready.png');
  });

  try {
    await test.step('create apex class (manifest source)', async () => {
      await createApexClass(page, className);
      await saveScreenshot(page, 'retrieveStaleApiVersion.container.02-create-class.png');
    });

    await test.step(`pin baseline sourceApiVersion=${WARM_API_VERSION}`, async () => {
      // Normalize the container fixture default (64.0) to a known baseline the test controls.
      await writeProjectApiVersion(page, WARM_API_VERSION);
    });

    await test.step(`warm the SfProject cache (sourceApiVersion=${WARM_API_VERSION})`, async () => {
      await openFileByName(page, `${className}.cls`);
      const warmManifest = await generateManifest(page, warmManifestFile);
      await expect(warmManifest.locator('.view-lines'), 'warmed manifest version').toContainText(
        `<version>${WARM_API_VERSION}</version>`
      );
      await saveScreenshot(page, 'retrieveStaleApiVersion.container.03-warm-manifest.png');
    });

    await test.step(`edit sfdx-project.json ${WARM_API_VERSION} -> ${EDITED_API_VERSION} through the editor`, async () => {
      await writeProjectApiVersion(page, EDITED_API_VERSION);
      await saveScreenshot(page, 'retrieveStaleApiVersion.container.04-after-edit.png');
    });

    await test.step('regenerate manifest picks up the edited version (cache invalidated)', async () => {
      // Re-focus the Apex class so it is the manifest source (the edit left sfdx-project.json active, which
      // is outside package directories and would hide the Generate Manifest command).
      await openFileByName(page, `${className}.cls`);
      const freshManifest = await generateManifest(page, freshManifestFile);
      await expect(freshManifest.locator('.view-lines'), 'fresh manifest version after edit').toContainText(
        `<version>${EDITED_API_VERSION}</version>`
      );
      await saveScreenshot(page, 'retrieveStaleApiVersion.container.05-fresh-manifest.png');
    });
  } finally {
    // Restore the fixture baseline so the shared persistent workbench is left as found.
    await writeProjectApiVersion(page, BASELINE_API_VERSION).catch(() => undefined);
  }

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
