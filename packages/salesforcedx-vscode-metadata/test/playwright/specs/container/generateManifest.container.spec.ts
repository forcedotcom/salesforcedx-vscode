/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the Generate Manifest entry points. The web twin
 * (generateManifest.headless.spec.ts) proves the command is reachable from the editor context menu
 * and the explorer folder context menu against a plain Page. This proves the same manifest generation
 * runs inside the Code Builder image, writing a package.xml into the workspace.
 *
 * Generates from the seeded fixture class (PagedResult.cls) and the classes folder, using unique
 * manifest names so the shared persistent workbench never collides across runs.
 */

import { expect } from '@playwright/test';
import {
  activeQuickInputWidget,
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  EDITOR,
  ensureSecondarySideBarHidden,
  executeEditorContextMenuCommand,
  executeExplorerContextMenuCommand,
  focusOnFilesExplorer,
  openFileFromExplorerTree,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { messages } from '../../../../src/messages/i18n';
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('Generate Manifest (Code Builder): generates via context menu entry points', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Unique per run so the shared, persistent workbench never overwrites an existing manifest.
  const editorManifest = `genManifestEditor${Date.now()}`;
  const folderManifest = `genManifestFolder${Date.now()}`;

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'generateManifest.container.01-ready.png');
  });

  await test.step('1. Editor context menu', async () => {
    await openFileFromExplorerTree(page, 'PagedResult.cls', ['force-app', 'main', 'default', 'classes']);
    const editor = page.locator('[data-uri*="PagedResult.cls"]').first();
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    await editor.click();

    await executeEditorContextMenuCommand(page, packageNls.project_generate_manifest_text, 'PagedResult.cls');

    const quickInput = activeQuickInputWidget(page);
    await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
    await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'attached', timeout: 10_000 });

    await page.keyboard.type(editorManifest);
    await page.keyboard.press('Enter');

    const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${editorManifest}.xml"]`).first();
    await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });

    await focusOnFilesExplorer(page);
    const manifestFile = page.getByRole('treeitem', { name: new RegExp(`${editorManifest}\\.xml`, 'i') });
    await expect(manifestFile).toBeVisible({ timeout: 10_000 });
    await saveScreenshot(page, 'generateManifest.container.02-editor-manifest.png');

    await closeAllEditors(page);
  });

  await test.step('2. Explorer context menu (folder)', async () => {
    await executeExplorerContextMenuCommand(page, /classes/i, packageNls.project_generate_manifest_text);

    const quickInput = activeQuickInputWidget(page);
    await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
    await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'attached', timeout: 10_000 });

    await page.keyboard.type(folderManifest);
    await page.keyboard.press('Enter');

    const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${folderManifest}.xml"]`).first();
    await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });

    await focusOnFilesExplorer(page);
    const manifestFile = page.getByRole('treeitem', { name: new RegExp(`${folderManifest}\\.xml`, 'i') });
    await expect(manifestFile).toBeVisible({ timeout: 10_000 });
    await saveScreenshot(page, 'generateManifest.container.03-folder-manifest.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
