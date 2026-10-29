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
 * Container: runs against the container's boot-authed org instead of a freshly created minimal org.
 * The throwaway class and both manifests are uniquely named and removed after the test, so the shared,
 * persistent workbench never collides across runs.
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
import { cleanupContainerFiles } from '../utils/containerCleanup';

// Container-only: the throwaway class's files and the generated manifests, removed after the test (pass
// or fail) so they don't pile up on the shared workbench — see utils/containerCleanup. The class is
// never deployed, so removing its files is enough (it also clears the pending local change).
const createdFiles: string[] = [];

if (isContainer) {
  test.beforeEach(async ({ page }) => {
    await resetContainerWorkbench(page);
  });
  test.afterEach(() => {
    cleanupContainerFiles(createdFiles.splice(0));
  });
}

test('Generate Manifest: generates via context menu entry points', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const className = `GenerateManifestTest${Date.now()}`;
  // Unique per run so the container's shared, persistent workbench never overwrites an existing manifest.
  const editorManifestBase = `genManifestEditor${Date.now()}`;
  const folderManifestBase = `genManifestFolder${Date.now()}`;
  createdFiles.push(
    `force-app/main/default/classes/${className}.cls`,
    `force-app/main/default/classes/${className}.cls-meta.xml`,
    `manifest/${editorManifestBase}.xml`,
    `manifest/${folderManifestBase}.xml`
  );

  await test.step('setup', async () => {
    // The container's fixture already awaited the workbench, and its boot org is already authed.
    const createResult = isContainer ? undefined : await createMinimalOrg();
    if (!isContainer) {
      await waitForVSCodeWorkbench(page);
    }
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'setup.after-workbench.png');
    if (createResult) {
      await upsertScratchOrgAuthFieldsToSettings(page, createResult);
      await saveScreenshot(page, 'setup.after-auth-fields.png');
    }

    const statusBarPage = new SourceTrackingStatusBarPage(page);
    await statusBarPage.waitForVisible(120_000);
    await saveScreenshot(page, 'setup.after-status-bar-visible.png');
  });

  await test.step('1. Editor context menu', async () => {
    // Create apex class (opens editor automatically)
    await createApexClass(page, className);
    await saveScreenshot(page, 'step1.after-create-class.png');

    // The editor context keys settle a beat after the file opens; wait until the command is contributed
    // for it so the context menu below includes it.
    await verifyCommandExists(page, packageNls.project_generate_manifest_text, 60_000);

    // Right-click in the editor → "SFDX: Generate Manifest File"
    await executeEditorContextMenuCommand(page, packageNls.project_generate_manifest_text, `${className}.cls`);
    await saveScreenshot(page, 'step1.after-context-menu.png');

    // Wait for input prompt
    const quickInput = activeQuickInputWidget(page);
    await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
    await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'attached', timeout: 10_000 });
    await saveScreenshot(page, 'step1.manifest-prompt-visible.png');

    // Replace the pre-selected default "package.xml" (the .xml extension is added automatically).
    await page.keyboard.type(editorManifestBase);
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step1.after-accept-filename.png');

    // Wait for manifest file to be created and opened
    const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${editorManifestBase}.xml"]`).first();
    await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'step1.manifest-opened.png');

    // Assert manifest file exists in explorer - focus explorer first, then look for file
    await focusOnFilesExplorer(page);
    const manifestFile = page.getByRole('treeitem', { name: new RegExp(`${editorManifestBase}\\.xml`, 'i') });
    await expect(manifestFile).toBeVisible({ timeout: 10_000 });
    await saveScreenshot(page, 'step1.manifest-in-explorer.png');

    // Close editors to prepare for next step
    await closeAllEditors(page);
    await saveScreenshot(page, 'step1.after-close-editors.png');
  });

  await test.step('2. Explorer context menu (folder)', async () => {
    // Right-click classes folder in explorer → "SFDX: Generate Manifest File"
    await executeExplorerContextMenuCommand(page, /classes/i, packageNls.project_generate_manifest_text);
    await saveScreenshot(page, 'step2.after-context-menu.png');

    // Wait for input prompt
    const quickInput = activeQuickInputWidget(page);
    await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
    await quickInput.getByText(messages.manifest_input_save_prompt).waitFor({ state: 'attached', timeout: 10_000 });
    await saveScreenshot(page, 'step2.manifest-prompt-visible.png');

    // Type a different filename to avoid overwrite prompt
    await page.keyboard.type(folderManifestBase);
    await saveScreenshot(page, 'step2.after-type-filename.png');
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'step2.after-accept-filename.png');

    // Wait for manifest file to be created and opened
    const manifestEditor = page.locator(`${EDITOR}[data-uri*="manifest/${folderManifestBase}.xml"]`).first();
    await manifestEditor.waitFor({ state: 'visible', timeout: 15_000 });
    await saveScreenshot(page, 'step2.manifest-opened.png');

    // Assert manifest file exists in explorer - focus explorer first, then look for file
    await focusOnFilesExplorer(page);
    const manifestFile = page.getByRole('treeitem', { name: new RegExp(`${folderManifestBase}\\.xml`, 'i') });
    await expect(manifestFile).toBeVisible({ timeout: 10_000 });
    await saveScreenshot(page, 'step2.manifest-in-explorer.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
