/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  activeQuickInputWidget,
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
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
    await saveScreenshot(page, 'rename.context-menu-fired.png');

    // Input box is pre-filled with the old name; select all + type new name
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type(newName);
    await page.keyboard.press('Enter');
    await saveScreenshot(page, 'rename.entered-new-name.png');
  });

  await test.step('verify rename took effect', async () => {
    const newFolder = page
      .locator('[role="treeitem"]')
      .filter({ hasText: new RegExp(`^${newName}$`, 'i') })
      .first();
    await expect(newFolder).toBeVisible({ timeout: 10_000 });

    const oldFolder = page.locator('[role="treeitem"]').filter({ hasText: new RegExp(`^${oldName}$`, 'i') });
    await expect(oldFolder).toHaveCount(0, { timeout: 5000 });
    await saveScreenshot(page, 'rename.verify-tree.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
