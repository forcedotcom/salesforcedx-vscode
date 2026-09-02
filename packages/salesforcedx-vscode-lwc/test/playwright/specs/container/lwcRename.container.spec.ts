/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the LWC rename command (ADR 0022). The web twin
 * (lwcRename.headless.spec.ts) proves the explorer/editor context-menu rename works against a plain
 * Page; this proves the same command works inside the Code Builder image, where the LWC extension
 * runs in the Node host alongside the full installed extension set. Pure local file operations — no
 * org needed — so it is a deterministic signal that the command is wired in the container.
 */

import { expect } from '@playwright/test';
import {
  activeQuickInputTextField,
  activeQuickInputWidget,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  executeEditorContextMenuCommand,
  executeExplorerContextMenuCommand,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForQuickInputFirstOption
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

test('LWC Rename (Code Builder): renames an existing bundle via explorer context menu', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  // Unique per-run names: the container drives a single sequential workbench, so fixed names would
  // collide with bundles another spec (or an earlier run) already created.
  const oldName = `renameLwcOld${Date.now()}`;
  const newName = `renameLwcNew${Date.now()}`;

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'lwcRename.container.01-ready.png');
  });

  await test.step('seed bundle via SFDX: Create LWC', async () => {
    await executeCommandWithCommandPalette(page, packageNls.lightning_generate_lwc_text);
    const quickInput = activeQuickInputWidget(page);
    await quickInput.waitFor({ state: 'attached', timeout: 30_000 });
    await waitForQuickInputFirstOption(page);
    await activeQuickInputWidget(page).getByRole('option').first().click({ force: true });
    await activeQuickInputWidget(page)
      .getByText(/Enter Lightning Web Component name/i)
      .waitFor({ state: 'attached', timeout: 10_000 });
    await page.keyboard.type(oldName);
    await page.keyboard.press('Enter');
    await waitForQuickInputFirstOption(page);
    await activeQuickInputWidget(page).getByRole('option').first().click({ force: true });
    await page
      .locator('[role="tab"]')
      .filter({ hasText: new RegExp(`${oldName}\\.js`, 'i') })
      .first()
      .waitFor({ state: 'visible', timeout: 20_000 });
    await saveScreenshot(page, 'lwcRename.container.02-create-seeded-bundle.png');
  });

  await test.step('rename the bundle via explorer context menu', async () => {
    await executeExplorerContextMenuCommand(page, oldName, packageNls.rename_lightning_component_text);
    // Wait for the input box (showInputBox) to take focus before typing.
    await activeQuickInputWidget(page).waitFor({ state: 'attached', timeout: 10_000 });
    await saveScreenshot(page, 'lwcRename.container.03-context-menu-fired.png');

    // Input box is pre-filled with the old name; fill atomically to avoid select-all/type focus race
    await activeQuickInputTextField(page).fill(newName, { force: true });
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'lwcRename.container.04-entered-new-name.png');
  });

  await test.step('verify rename took effect', async () => {
    const newFolder = page
      .locator('[role="treeitem"]')
      .filter({ hasText: new RegExp(`^${newName}$`, 'i') })
      .first();
    // Debounced file watcher lags the tree refresh; poll until the renamed folder appears.
    await expect(async () => {
      await expect(newFolder).toBeVisible();
    }).toPass({ timeout: 20_000 });

    const oldFolder = page.locator('[role="treeitem"]').filter({ hasText: new RegExp(`^${oldName}$`, 'i') });
    // Same debounced watcher lag can delay the old-name treeitem disappearing.
    await expect(oldFolder).toHaveCount(0, { timeout: 20_000 });
    await saveScreenshot(page, 'lwcRename.container.05-verify-tree.png');
  });

  // Follow-up: rename again via editor context menu. The renamed bundle's main file is in the active editor.
  const finalName = `renameLwcFinal${Date.now()}`;
  await test.step('rename again via editor context menu', async () => {
    await executeEditorContextMenuCommand(page, packageNls.rename_lightning_component_text, `${newName}.js`);
    await activeQuickInputWidget(page).waitFor({ state: 'attached', timeout: 10_000 });
    await activeQuickInputTextField(page).fill(finalName, { force: true });
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'lwcRename.container.06-editor-menu-fired.png');
  });

  await test.step('verify second rename', async () => {
    const finalFolder = page
      .locator('[role="treeitem"]')
      .filter({ hasText: new RegExp(`^${finalName}$`, 'i') })
      .first();
    // Debounced file watcher lags the tree refresh; poll until the renamed folder appears.
    await expect(async () => {
      await expect(finalFolder).toBeVisible();
    }).toPass({ timeout: 20_000 });
    await saveScreenshot(page, 'lwcRename.container.07-verify-second-rename.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
