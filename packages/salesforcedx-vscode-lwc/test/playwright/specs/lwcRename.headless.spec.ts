/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
  waitForQuickInputFirstOption,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';

test('LWC Rename: renames an existing bundle via explorer context menu', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const oldName = `renameLwcOld${Date.now()}`;
  const newName = `renameLwcNew${Date.now()}`;

  await test.step('setup', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
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
    await saveScreenshot(page, 'rename.create-seeded-bundle.png');
  });

  await test.step('rename the bundle via explorer context menu', async () => {
    await executeExplorerContextMenuCommand(page, oldName, packageNls.rename_lightning_component_text);
    // Wait for the input box (showInputBox) to take focus before typing.
    await activeQuickInputWidget(page).waitFor({ state: 'attached', timeout: 10_000 });
    await saveScreenshot(page, 'rename.context-menu-fired.png');

    // Input box is pre-filled with the old name; fill atomically to avoid select-all/type focus race
    await activeQuickInputTextField(page).fill(newName, { force: true });
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'rename.entered-new-name.png');
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
    await expect(oldFolder).toHaveCount(0, { timeout: 5000 });
    await saveScreenshot(page, 'rename.verify-tree.png');
  });

  // Follow-up: rename again via editor context menu. The renamed bundle's main file is in the active editor.
  const finalName = `renameLwcFinal${Date.now()}`;
  await test.step('rename again via editor context menu', async () => {
    await executeEditorContextMenuCommand(page, packageNls.rename_lightning_component_text, `${newName}.js`);
    await activeQuickInputWidget(page).waitFor({ state: 'attached', timeout: 10_000 });
    await activeQuickInputTextField(page).fill(finalName, { force: true });
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'rename.editor-menu-fired.png');
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
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
