/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  activeQuickInputTextField,
  activeQuickInputWidget,
  closeWelcomeTabs,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForQuickInputFirstOption,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';

test('LWC Generate Component: creates new LWC via command palette', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const componentName = `generateLwcTest${Date.now()}`;

  await test.step('setup with no org', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
    await saveScreenshot(page, 'setup.after-workbench.png');
  });

  await test.step('command is present', async () => {
    await verifyCommandExists(page, packageNls.lightning_generate_lwc_text, 120_000);
  });

  await test.step('create LWC via command palette', async () => {
    await executeCommandWithCommandPalette(page, packageNls.lightning_generate_lwc_text);
    await saveScreenshot(page, 'step1.after-command.png');

    const quickInput = activeQuickInputWidget(page);
    await quickInput.waitFor({ state: 'attached', timeout: 30_000 });

    // Step 1: Select component type (JavaScript/TypeScript)
    // Click the first option instead of Enter — 1.116+ sometimes drops Enter on quick picks (see PR #7193).
    await waitForQuickInputFirstOption(page);
    await saveScreenshot(page, 'step1.component-type-prompt-visible.png');
    await activeQuickInputWidget(page).getByRole('option').first().click({ force: true });
    await saveScreenshot(page, 'step1.component-type-selected.png');

    // Step 2: Enter component name
    await activeQuickInputWidget(page)
      .getByText(/Enter Lightning Web Component name/i)
      .waitFor({ state: 'attached', timeout: 10_000 });
    await saveScreenshot(page, 'step1.name-prompt-visible.png');
    await activeQuickInputTextField(page).fill(componentName, { force: true });
    await saveScreenshot(page, 'step1.after-type-name.png');
    await page.keyboard.press('Enter');

    // Step 3: Select output directory (click first option instead of Enter)
    await waitForQuickInputFirstOption(page);
    await saveScreenshot(page, 'step1.directory-prompt-visible.png');
    await activeQuickInputWidget(page).getByRole('option').first().click({ force: true });
    await saveScreenshot(page, 'step1.after-accept-directory.png');

    // Step 4: Wait for editor to open with the new component
    await page.locator(EDITOR_WITH_URI).first().waitFor({ state: 'visible', timeout: 20_000 });
    await saveScreenshot(page, 'step1.editor-opened.png');
  });

  await test.step('verify component was created correctly', async () => {
    const editorTab = page.locator('[role="tab"]').filter({ hasText: new RegExp(`${componentName}\\.js`, 'i') });
    await expect(editorTab).toBeVisible({ timeout: 1000 });
    await saveScreenshot(page, 'step2.tab-visible.png');

    const explorerFolder = page
      .locator('[role="treeitem"]')
      .filter({ hasText: new RegExp(`${componentName}$`, 'i') })
      .first();
    await expect(explorerFolder).toBeVisible({ timeout: 500 });
    await saveScreenshot(page, 'step2.folder-in-explorer.png');

    const editorContent = page.locator(`[data-uri*="${componentName}.js"]`).first();
    await expect(editorContent).toBeVisible({ timeout: 500 });

    const editorText = page.locator('.view-lines').first();
    await expect(editorText).toContainText('import { LightningElement }', { timeout: 100 });
    await saveScreenshot(page, 'step2.component-content-verified.png');

    // Explorer: folder auto-expanded when .js opened. Same on web and desktop.
    await expect(page.getByRole('treeitem', { name: new RegExp(`${componentName}\\.html$`, 'i') })).toBeVisible({
      timeout: 2000
    });
    await expect(
      page.getByRole('treeitem', { name: new RegExp(`${componentName}\\.js-meta\\.xml$`, 'i') })
    ).toBeVisible({ timeout: 2000 });
    await expect(page.getByRole('treeitem', { name: '__tests__' })).toBeVisible({ timeout: 2000 });
    await saveScreenshot(page, 'step2.all-files-verified.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
