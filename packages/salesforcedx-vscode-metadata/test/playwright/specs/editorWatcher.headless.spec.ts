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
 * Container: uses the seeded fixture class (PagedResult.cls) as the in-package editor instead of
 * creating a throwaway apex class, and sfdx-project.json as the out-of-package editor, so no source is
 * created or mutated on the shared workbench.
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

// Commands that depend on sf:in_package_directories context
const COMMANDS_TO_TEST = [
  packageNls.deploy_this_source_text,
  packageNls.retrieve_this_source_text,
  packageNls.delete_source_text,
  packageNls.diff_source_against_org_text
];

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
}

test('EditorWatcher: deploy commands show/hide based on active editor location', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let className: string;

  await test.step('setup', async () => {
    if (isContainer) {
      // The containerTest fixture already awaited workbench readiness before handing over `page`.
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      // Status bar visibility confirms the metadata extension has activated against the boot org.
      const statusBarPage = new SourceTrackingStatusBarPage(page);
      await statusBarPage.waitForVisible(120_000);
      await saveScreenshot(page, 'editorWatcher.01-ready.png');
    } else {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);

      const statusBarPage = new SourceTrackingStatusBarPage(page);
      await statusBarPage.waitForVisible(120_000);
    }
  });

  await test.step('open in-package editor', async () => {
    const openInPackageEditorContainer = async (): Promise<void> => {
      // Use the seeded fixture class rather than mutating the shared workbench with a new one.
      // The Explorer tree open can transiently flake on the shared workbench (virtual scrolling /
      // focus), so retry the open as a unit.
      await expect(async () => {
        await openFileFromExplorerTree(page, 'PagedResult.cls', ['force-app', 'main', 'default', 'classes']);
        const editor = page.locator(EDITOR_WITH_URI).first();
        await expect(editor).toBeVisible();
        await expect(editor).toHaveAttribute('data-uri', /PagedResult\.cls/);
      }).toPass({ timeout: 90_000, intervals: [1000, 2000, 5000] });
    };
    const openInPackageEditorDesktop = async (): Promise<void> => {
      className = `EditorWatcherTest${Date.now()}`;
      await createApexClass(page, className);

      const editor = page.locator(EDITOR_WITH_URI).first();
      await expect(editor).toBeVisible();
      await expect(editor).toHaveAttribute('data-uri', new RegExp(`${className}\\.cls`));
    };
    await (isContainer ? openInPackageEditorContainer : openInPackageEditorDesktop)();
  });

  await test.step('verify deploy/retrieve commands are in command palette', async () => {
    // Use retry pattern to allow VS Code rendering and context updates
    for (const commandText of COMMANDS_TO_TEST) {
      await verifyCommandExists(page, commandText);
    }
    await saveScreenshot(
      page,
      isContainer ? 'editorWatcher.02-commands-present.png' : 'step3.command-palette-has-commands.png'
    );
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
    await saveScreenshot(
      page,
      isContainer ? 'editorWatcher.03-commands-hidden.png' : 'step6.command-palette-no-commands.png'
    );
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
