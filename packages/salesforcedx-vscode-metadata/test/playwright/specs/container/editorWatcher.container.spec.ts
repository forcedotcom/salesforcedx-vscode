/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the editor-watcher command gating. The web twin
 * (editorWatcher.headless.spec.ts) proves the deploy/retrieve/delete/diff commands show or hide based
 * on whether the active editor is inside a package directory, against a plain Page. This proves the
 * same sf:in_package_directories context wiring behaves identically inside the Code Builder image.
 *
 * Uses the seeded fixture class (PagedResult.cls) as the in-package editor and sfdx-project.json as
 * the out-of-package editor, so no source is created or mutated.
 */

import { expect } from '@playwright/test';
import {
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  focusOnFilesExplorer,
  openFileFromExplorerTree,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandDoesNotExist,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../../pages/sourceTrackingStatusBarPage';
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

// Commands that depend on the sf:in_package_directories context.
const COMMANDS_TO_TEST = [
  packageNls.deploy_this_source_text,
  packageNls.retrieve_this_source_text,
  packageNls.delete_source_text,
  packageNls.diff_source_against_org_text
];

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('EditorWatcher (Code Builder): deploy commands show/hide based on active editor location', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    // Status bar visibility confirms the metadata extension has activated against the boot org.
    const statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);
    await saveScreenshot(page, 'editorWatcher.container.01-ready.png');
  });

  await test.step('open the fixture class (inside a package directory)', async () => {
    await openFileFromExplorerTree(page, 'PagedResult.cls', ['force-app', 'main', 'default', 'classes']);
    const editor = page.locator(EDITOR_WITH_URI).first();
    await expect(editor).toBeVisible();
    await expect(editor).toHaveAttribute('data-uri', /PagedResult\.cls/);
  });

  await test.step('verify deploy/retrieve commands are in command palette', async () => {
    for (const commandText of COMMANDS_TO_TEST) {
      await verifyCommandExists(page, commandText);
    }
    await saveScreenshot(page, 'editorWatcher.container.02-commands-present.png');
  });

  await test.step('open sfdx-project.json (not in a package directory)', async () => {
    // The expanded metadata tree pushes root files outside the virtualized DOM.
    await focusOnFilesExplorer(page);
    await page.keyboard.press('End');
    await openFileFromExplorerTree(page, 'sfdx-project.json');

    const editor = page.locator(EDITOR_WITH_URI).first();
    await expect(editor).toHaveAttribute('data-uri', /sfdx-project\.json/);
  });

  await test.step('assert deploy/retrieve commands not in command palette', async () => {
    for (const commandText of COMMANDS_TO_TEST) {
      await verifyCommandDoesNotExist(page, commandText);
    }
    await saveScreenshot(page, 'editorWatcher.container.03-commands-hidden.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
