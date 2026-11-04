/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers the editor-watcher command gating: deploy/retrieve/delete/diff commands show or hide based on
 * whether the active editor is inside a package directory (the sf:in_package_directories context).
 *
 * Container: runs against the container's boot-authed org instead of a freshly created minimal org,
 * with a uniquely-named throwaway class as the in-package editor (removed after the test) and
 * sfdx-project.json as the out-of-package editor.
 */

import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  createApexClass,
  createMinimalOrg,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  focusOnFilesExplorer,
  openFileFromExplorerTree,
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
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import packageNls from '../../../package.nls.json';
import { isContainer, sharedTest as test } from '../fixtures';
import { cleanupContainerFiles } from '../utils/containerCleanup';

// Commands that depend on sf:in_package_directories context
const COMMANDS_TO_TEST = [
  packageNls.deploy_this_source_text,
  packageNls.retrieve_this_source_text,
  packageNls.delete_source_text,
  packageNls.diff_source_against_org_text
];

// Container-only: files of the throwaway class this test created, removed after it (pass or fail) so
// they don't pile up on the shared workbench — see utils/containerCleanup. The class is never deployed,
// so removing its files is enough (it also clears the pending local change).
const createdFiles: string[] = [];

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
  test.afterEach(() => {
    cleanupContainerFiles(createdFiles.splice(0));
  });
}

test('EditorWatcher: deploy commands show/hide based on active editor location', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup', async () => {
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

    // Status bar visibility confirms the metadata extension has activated against the org.
    const statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);
  });

  await test.step('open in-package editor', async () => {
    const className = `EditorWatcherTest${Date.now()}`;
    createdFiles.push(
      `force-app/main/default/classes/${className}.cls`,
      `force-app/main/default/classes/${className}.cls-meta.xml`
    );
    await createApexClass(page, className);

    const editor = page.locator(EDITOR_WITH_URI).first();
    await expect(editor).toBeVisible();
    await expect(editor).toHaveAttribute('data-uri', new RegExp(`${className}\\.cls`));
  });

  await test.step('verify deploy/retrieve commands are in command palette', async () => {
    // Use retry pattern to allow VS Code rendering and context updates
    for (const commandText of COMMANDS_TO_TEST) {
      await verifyCommandExists(page, commandText);
    }
    await saveScreenshot(page, 'step3.command-palette-has-commands.png');
  });

  await test.step('open sfdx-project.json (not in package directory)', async () => {
    // The expanded metadata tree pushes root files outside the virtualized DOM.
    await focusOnFilesExplorer(page);
    await page.keyboard.press('End');
    await openFileFromExplorerTree(page, 'sfdx-project.json');

    // Verify it's the active editor
    const editor = page.locator(EDITOR_WITH_URI).first();
    await expect(editor).toHaveAttribute('data-uri', /sfdx-project\.json/);
  });

  await test.step('assert deploy/retrieve commands not in command palette', async () => {
    // Use retry pattern to allow VS Code rendering and context updates
    for (const commandText of COMMANDS_TO_TEST) {
      await verifyCommandDoesNotExist(page, commandText);
    }
    await saveScreenshot(page, 'step6.command-palette-no-commands.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
