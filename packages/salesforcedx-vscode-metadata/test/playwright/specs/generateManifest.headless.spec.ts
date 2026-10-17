/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Covers the Generate Manifest entry points: reachable from the editor context menu and the explorer
 * folder context menu, writing a package.xml into the workspace.
 *
 * Container: generates from the seeded fixture class (PagedResult.cls) and the classes folder using
 * unique manifest names, so the shared persistent workbench never collides across runs.
 */

import { expect } from '@playwright/test';
import {
  activeQuickInputWidget,
  closeAllEditors,
  closeWelcomeTabs,
  createApexClass,
  createMinimalOrg,
  EDITOR,
  ensureSecondarySideBarHidden,
  executeEditorContextMenuCommand,
  executeExplorerContextMenuCommand,
  focusOnFilesExplorer,
  openFileFromExplorerTree,
  resetContainerWorkbench,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  upsertScratchOrgAuthFieldsToSettings,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { SourceTrackingStatusBarPage } from '../pages/sourceTrackingStatusBarPage';
import packageNls from '../../../package.nls.json';
import { messages } from '../../../src/messages/i18n';
import { isContainer, sharedTest as test } from '../fixtures';

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
}

test('Generate Manifest: generates via context menu entry points', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let className: string;

  // Unique per run so the container's shared, persistent workbench never overwrites an existing
  // manifest. Desktop/headless accept the default "package.xml"/type "package2" since each run gets a
  // fresh project.
  const editorManifestBase = isContainer ? `genManifestEditor${Date.now()}` : 'package';
  const folderManifestBase = isContainer ? `genManifestFolder${Date.now()}` : 'package2';

  await test.step('setup', async () => {
    if (isContainer) {
      // The containerTest fixture already awaited workbench readiness before handing over `page`.
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await saveScreenshot(page, 'generateManifest.01-ready.png');
    } else {
      const createResult = await createMinimalOrg();
      await waitForVSCodeWorkbench(page);
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
      await saveScreenshot(page, 'setup.after-workbench.png');
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
      await saveScreenshot(page, 'setup.after-auth-fields.png');

      const statusBarPage = new SourceTrackingStatusBarPage(page);
      await statusBarPage.waitForVisible(120_000);
      await saveScreenshot(page, 'setup.after-status-bar-visible.png');
    }
  });

  await test.step('1. Editor context menu', async () => {
    const prepareManifestEditorContextMenuContainer = async (): Promise<void> => {
      // Use the seeded fixture class rather than mutating the shared workbench with a new one.
      // The Explorer tree open can transiently flake on the shared workbench (virtual scrolling /
      // focus), so retry the open+focus as a unit.
      await expect(async () => {
        await openFileFromExplorerTree(page, 'PagedResult.cls', ['force-app', 'main', 'default', 'classes']);
        const editor = page.locator('[data-uri*="PagedResult.cls"]').first();
        await editor.waitFor({ state: 'visible', timeout: 15_000 });
        await editor.click();
      }).toPass({ timeout: 90_000, intervals: [1000, 2000, 5000] });

      // Right-click in the editor → "SFDX: Generate Manifest File", matching the desktop entry point.
      await verifyCommandExists(page, packageNls.project_generate_manifest_text, 60_000);
      // On the shared container workbench the context-menu click can occasionally land without the
      // command actually opening the input box (no error from selectContextMenuItem, just a silent
      // miss), so retry the trigger-and-wait as a unit rather than only the editor-open step above.
      await expect(async () => {
        await executeEditorContextMenuCommand(page, packageNls.project_generate_manifest_text, 'PagedResult.cls');
        const quickInput = activeQuickInputWidget(page);
        await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
        await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'attached', timeout: 10_000 });
      }).toPass({ timeout: 60_000, intervals: [2000, 5000] });
    };
    const prepareManifestEditorContextMenuDesktop = async (): Promise<void> => {
      // Create apex class (opens editor automatically)
      className = `GenerateManifestTest${Date.now()}`;
      await createApexClass(page, className);
      await saveScreenshot(page, 'step1.after-create-class.png');

      // Right-click in the editor → "SFDX: Generate Manifest File"
      await executeEditorContextMenuCommand(page, packageNls.project_generate_manifest_text, `${className}.cls`);
      await saveScreenshot(page, 'step1.after-context-menu.png');

      // Wait for input prompt
      const quickInput = activeQuickInputWidget(page);
      await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
      await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'attached', timeout: 10_000 });
      await saveScreenshot(page, 'step1.manifest-prompt-visible.png');
    };
    await (isContainer ? prepareManifestEditorContextMenuContainer : prepareManifestEditorContextMenuDesktop)();

    if (isContainer) {
      await page.keyboard.type(editorManifestBase);
    }
    // Accept the filename (default "package.xml" on desktop, the typed unique name in the container)
    await page.keyboard.press('Enter');
    if (!isContainer) {
      await saveScreenshot(page, 'step1.after-accept-filename.png');
    }

    // Wait for manifest file to be created and opened
    const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${editorManifestBase}.xml"]`).first();
    await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
    if (!isContainer) {
      await saveScreenshot(page, 'step1.manifest-opened.png');
    }

    // Assert manifest file exists in explorer - focus explorer first, then look for file
    await focusOnFilesExplorer(page);
    const manifestFile = page.getByRole('treeitem', { name: new RegExp(`${editorManifestBase}\\.xml`, 'i') });
    await expect(manifestFile).toBeVisible({ timeout: 10_000 });
    await saveScreenshot(
      page,
      isContainer ? 'generateManifest.02-editor-manifest.png' : 'step1.manifest-in-explorer.png'
    );

    // Close editors to prepare for next step
    await closeAllEditors(page);
    if (!isContainer) {
      await saveScreenshot(page, 'step1.after-close-editors.png');
    }
  });

  await test.step('2. Explorer context menu (folder)', async () => {
    // Right-click classes folder in explorer → "SFDX: Generate Manifest File"
    await executeExplorerContextMenuCommand(page, /classes/i, packageNls.project_generate_manifest_text);
    if (!isContainer) {
      await saveScreenshot(page, 'step2.after-context-menu.png');
    }

    // Wait for input prompt
    const quickInput = activeQuickInputWidget(page);
    await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
    await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'attached', timeout: 10_000 });
    if (!isContainer) {
      await saveScreenshot(page, 'step2.manifest-prompt-visible.png');
    }

    // Type a different filename to avoid overwrite prompt
    await page.keyboard.type(folderManifestBase);
    if (!isContainer) {
      await saveScreenshot(page, 'step2.after-type-filename.png');
    }
    await page.keyboard.press('Enter');
    if (!isContainer) {
      await saveScreenshot(page, 'step2.after-accept-filename.png');
    }

    // Wait for manifest file to be created and opened
    const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${folderManifestBase}.xml"]`).first();
    await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
    if (!isContainer) {
      await saveScreenshot(page, 'step2.manifest-opened.png');
    }

    // Assert manifest file exists in explorer - focus explorer first, then look for file
    await focusOnFilesExplorer(page);
    const manifestFile = page.getByRole('treeitem', { name: new RegExp(`${folderManifestBase}\\.xml`, 'i') });
    await expect(manifestFile).toBeVisible({ timeout: 10_000 });
    await saveScreenshot(
      page,
      isContainer ? 'generateManifest.03-folder-manifest.png' : 'step2.manifest-in-explorer.png'
    );
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
