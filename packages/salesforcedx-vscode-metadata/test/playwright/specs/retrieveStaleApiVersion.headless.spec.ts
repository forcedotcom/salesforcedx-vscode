/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test } from '../fixtures';
import { expect, type Page } from '@playwright/test';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createMinimalOrg,
  upsertScratchOrgAuthFieldsToSettings,
  createApexClass,
  openFileByName,
  executeCommandWithCommandPalette,
  activeQuickInputWidget,
  activeQuickInputTextField,
  validateNoCriticalErrors,
  ensureSecondarySideBarHidden,
  saveScreenshot,
  EDITOR,
  DIRTY_EDITOR
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import packageNls from '../../../package.nls.json';
import { messages } from '../../../src/messages/i18n';
import { RETRIEVE_TIMEOUT } from '../../constants';

// Cross-platform (web + desktop): edits sfdx-project.json THROUGH the editor (not Node fs) and reads the
// generated manifest from the editor (not Node fs), so the FileSystemWatcher -> FileChangePubSub ->
// invalidateSfProjectCache pipeline is exercised on both the desktop file:// fs and the web memfs.
// Two distinct non-default values; the warm step pins the first so the test is independent of the
// platform default (desktop fixture 64.0, web memfs template 67.0).
const WARM_API_VERSION = '63.0';
const EDITED_API_VERSION = '62.0';

/** sfdx-project.json body with a given sourceApiVersion; pasted whole so the test is independent of the platform default. */
const projectJson = (sourceApiVersion: string): string =>
  JSON.stringify(
    {
      packageDirectories: [{ path: 'force-app', default: true }],
      namespace: '',
      sfdcLoginUrl: 'https://login.salesforce.com',
      sourceApiVersion
    },
    null,
    2
  );

/** Open sfdx-project.json from the Explorer and overwrite its full contents with `sourceApiVersion`, then save. */
const writeProjectApiVersion = async (page: Page, sourceApiVersion: string) => {
  await executeCommandWithCommandPalette(page, 'File: Focus on Files Explorer');
  const projectFile = page.getByRole('treeitem', { name: /sfdx-project\.json/ });
  await projectFile.waitFor({ state: 'visible', timeout: 10_000 });
  await projectFile.dblclick();

  const editor = page.locator(`${EDITOR}[data-uri$="sfdx-project.json"]`).first();
  await editor.waitFor({ state: 'visible', timeout: 10_000 });
  await editor.locator('.view-line').first().waitFor({ state: 'visible', timeout: 5000 });
  await editor.click();

  // Select-all + paste (clipboard) mirrors createApexClass: keyboard shortcuts can miss on web.
  await executeCommandWithCommandPalette(page, 'Select All');
  await page.keyboard.press('Delete');
  await page.evaluate((text: string) => navigator.clipboard.writeText(text), projectJson(sourceApiVersion));
  await executeCommandWithCommandPalette(page, 'Paste');

  // Guard: the edit must actually land in the editor buffer (Paste can silently miss on web if focus
  // is wrong). Asserting the new value is present rules out a test artifact when downstream fails.
  await expect(editor.locator('.view-lines'), 'edited sfdx-project.json buffer').toContainText(
    `"sourceApiVersion": "${sourceApiVersion}"`
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

test('manifest version tracks mid-session sourceApiVersion edit without reload', async ({ page }) => {
  test.setTimeout(RETRIEVE_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const className = `StaleApiVersion${Date.now()}`;

  await test.step('setup minimal org', async () => {
    const createResult = await createMinimalOrg();
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);

    const statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);
    await saveScreenshot(page, 'stale-api.after-setup.png');
  });

  await test.step('create apex class', async () => {
    await createApexClass(page, className);
    await saveScreenshot(page, 'stale-api.after-create-class.png');
  });

  await test.step(`pin baseline sourceApiVersion=${WARM_API_VERSION}`, async () => {
    // Normalize the platform default (web template 67.0, desktop fixture 64.0) to a known baseline.
    await writeProjectApiVersion(page, WARM_API_VERSION);
  });

  await test.step(`warm the SfProject cache (sourceApiVersion=${WARM_API_VERSION})`, async () => {
    await openFileByName(page, `${className}.cls`);
    const warmManifest = await generateManifest(page, 'pkgWarm.xml');
    // Baseline: the warmed manifest reflects the pinned baseline, proving the cache holds it.
    await expect(warmManifest.locator('.view-lines'), 'warmed manifest version').toContainText(
      `<version>${WARM_API_VERSION}</version>`
    );
    await saveScreenshot(page, 'stale-api.warm-manifest.png');
  });

  await test.step(`edit sfdx-project.json sourceApiVersion ${WARM_API_VERSION} -> ${EDITED_API_VERSION} through the editor`, async () => {
    await writeProjectApiVersion(page, EDITED_API_VERSION);
    // The FileSystemWatcher -> FileChangePubSub -> 5ms debounce -> invalidateSfProjectCache pipeline is async.
    // Re-generating the manifest re-resolves a fresh SfProject; expect-with-retry below absorbs the latency.
    await saveScreenshot(page, 'stale-api.after-edit.png');
  });

  await test.step('regenerate manifest picks up the edited version (cache invalidated)', async () => {
    // Re-focus the Apex class so it is the manifest source (the edit left sfdx-project.json active, which is
    // outside package directories and would hide the Generate Manifest command).
    await openFileByName(page, `${className}.cls`);
    const freshManifest = await generateManifest(page, 'pkgFresh.xml');
    // The fix: a fresh SfProject is resolved, so the manifest tracks the edited value, not the stale baseline.
    await expect(freshManifest.locator('.view-lines'), 'fresh manifest version after edit').toContainText(
      `<version>${EDITED_API_VERSION}</version>`
    );
    await saveScreenshot(page, 'stale-api.fresh-manifest.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
