/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers the sfdx-project.json cache-invalidation fix: the FileSystemWatcher -> FileChangePubSub ->
 * invalidateSfProjectCache pipeline picks up a mid-session sourceApiVersion edit without a reload. It
 * edits sfdx-project.json THROUGH the editor (not Node fs) and reads the generated manifest from the
 * editor (not Node fs), so the pipeline is exercised on the real fs (desktop file://, container
 * file://) or web memfs.
 *
 * The scenario is entirely local (editor edits + manifest generation) — it does not touch the org.
 *
 * Container: runs against the container's boot workspace instead of a freshly created minimal org, and
 * uses per-run unique manifest filenames (rather than fixed pkgWarm.xml/pkgFresh.xml) to avoid
 * collisions on the shared persistent workbench, restoring sfdx-project.json to the fixture baseline
 * (64.0) afterward so the workbench is left as found.
 */

import { expect, type Page } from '@playwright/test';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createMinimalOrg,
  upsertScratchOrgAuthFieldsToSettings,
  createApexClass,
  focusOnFilesExplorer,
  openFileFromExplorerTree,
  openFileByName,
  executeCommandWithCommandPalette,
  activeQuickInputWidget,
  activeQuickInputTextField,
  validateNoCriticalErrors,
  ensureSecondarySideBarHidden,
  disableMonacoAutoClosing,
  saveScreenshot,
  EDITOR,
  DIRTY_EDITOR,
  resetContainerWorkbench,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import packageNls from '../../../package.nls.json';
import { messages } from '../../../src/messages/i18n';
import { RETRIEVE_TIMEOUT } from '../../constants';
import { isContainer, sharedTest as test } from '../fixtures';

// Two distinct non-default values; the warm step pins the first so the test is independent of the
// platform default (desktop fixture 64.0, web memfs template 67.0, container fixture 64.0).
// BASELINE_API_VERSION restores the container fixture on the way out.
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
  // No clipboard: it is a shared global resource and parallel workers race on it (desktop Electron
  // clipboard is the system OS clipboard). disableMonacoAutoClosing stops `{`/`[`/`"` from doubling.
  await disableMonacoAutoClosing(page);
  await editor.click();
  await executeCommandWithCommandPalette(page, 'Select All');
  await page.keyboard.press('Delete');
  await page.keyboard.type(projectJson(sourceApiVersion));

  // Guard: the edit must actually land in the editor buffer (typing can silently miss on web if focus
  // is wrong). Asserting the new value is present rules out a test artifact when downstream fails.
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

  // Per-call name avoids the overwrite modal on the second run. `fill` clears + sets atomically;
  // Control+a is move-to-line-start (readline) on macOS, not select-all.
  await activeQuickInputTextField(page).fill(fileName.replace(/\.xml$/i, ''));
  await page.keyboard.press('Enter');

  const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${fileName}"]`).first();
  await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
  return manifestEditor;
};

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
}

test('manifest version tracks mid-session sourceApiVersion edit without reload', async ({ page }) => {
  test.setTimeout(RETRIEVE_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const ts = Date.now();
  const className = `StaleApiVersion${ts}`;
  // Per-run manifest names in the container avoid the overwrite modal / collisions in the shared
  // persistent workbench; desktop/headless use fixed names since each run gets a fresh project.
  const warmManifestFile = isContainer ? `pkgWarm${ts}.xml` : 'pkgWarm.xml';
  const freshManifestFile = isContainer ? `pkgFresh${ts}.xml` : 'pkgFresh.xml';

  await test.step('setup', async () => {
    if (isContainer) {
      // The containerTest fixture already awaited workbench readiness before handing over `page`.
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      // Wait on a command that is always contributed once the extension activates. The Generate
      // Manifest command is context-gated (it only surfaces when an editor inside a package directory
      // is active), so probing for it here — before any file is open — flakes with "not found" on the
      // shared workbench. "SFDX: Create Apex Class" (needed by the very next step) is the reliable
      // activation signal.
      await verifyCommandExists(page, 'SFDX: Create Apex Class', 60_000);
      await saveScreenshot(page, 'retrieveStaleApiVersion.01-ready.png');
    } else {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);

      const statusBarPage = new SourceTrackingStatusBarPage(page);
      await statusBarPage.waitForVisible(120_000);
      await saveScreenshot(page, 'stale-api.after-setup.png');
    }
  });

  try {
    await test.step('create apex class', async () => {
      await createApexClass(page, className);
      await saveScreenshot(
        page,
        isContainer ? 'retrieveStaleApiVersion.02-create-class.png' : 'stale-api.after-create-class.png'
      );
    });

    await test.step(`pin baseline sourceApiVersion=${WARM_API_VERSION}`, async () => {
      // Normalize the platform default (web template 67.0, desktop fixture 64.0, container fixture
      // 64.0) to a known baseline.
      await writeProjectApiVersion(page, WARM_API_VERSION);
    });

    await test.step(`warm the SfProject cache (sourceApiVersion=${WARM_API_VERSION})`, async () => {
      await openFileByName(page, `${className}.cls`);
      const warmManifest = await generateManifest(page, warmManifestFile);
      // Baseline: the warmed manifest reflects the pinned baseline, proving the cache holds it.
      await expect(warmManifest.locator('.view-lines'), 'warmed manifest version').toContainText(
        `<version>${WARM_API_VERSION}</version>`
      );
      await saveScreenshot(
        page,
        isContainer ? 'retrieveStaleApiVersion.03-warm-manifest.png' : 'stale-api.warm-manifest.png'
      );
    });

    await test.step(`edit sfdx-project.json sourceApiVersion ${WARM_API_VERSION} -> ${EDITED_API_VERSION} through the editor`, async () => {
      await writeProjectApiVersion(page, EDITED_API_VERSION);
      // The FileSystemWatcher -> FileChangePubSub -> 5ms debounce -> invalidateSfProjectCache pipeline is async.
      // Re-generating the manifest re-resolves a fresh SfProject; expect-with-retry below absorbs the latency.
      await saveScreenshot(
        page,
        isContainer ? 'retrieveStaleApiVersion.04-after-edit.png' : 'stale-api.after-edit.png'
      );
    });

    await test.step('regenerate manifest picks up the edited version (cache invalidated)', async () => {
      // Re-focus the Apex class so it is the manifest source (the edit left sfdx-project.json active, which is
      // outside package directories and would hide the Generate Manifest command).
      await openFileByName(page, `${className}.cls`);
      const freshManifest = await generateManifest(page, freshManifestFile);
      // The fix: a fresh SfProject is resolved, so the manifest tracks the edited value, not the stale baseline.
      await expect(freshManifest.locator('.view-lines'), 'fresh manifest version after edit').toContainText(
        `<version>${EDITED_API_VERSION}</version>`
      );
      await saveScreenshot(
        page,
        isContainer ? 'retrieveStaleApiVersion.05-fresh-manifest.png' : 'stale-api.fresh-manifest.png'
      );
    });
  } finally {
    if (isContainer) {
      // Restore the fixture baseline so the shared persistent workbench is left as found.
      await writeProjectApiVersion(page, BASELINE_API_VERSION).catch(() => undefined);
    }
  }

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
