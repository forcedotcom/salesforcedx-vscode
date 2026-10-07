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
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  saveScreenshot,
  selectQuickInputOption,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForQuickInputFirstOption,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';
import { isContainer, sharedTest as test } from '../fixtures';

test('LWC Generate Component: creates new LWC via command palette', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);
  const componentName = `generateLwcTest${Date.now()}`;

  await test.step('setup with no org', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    if (!isContainer) {
      await waitForVSCodeWorkbench(page);
    }
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    if (!isContainer) {
      await waitForWorkspaceReady(page);
    }
  });

  await test.step('command is present', async () => {
    await verifyCommandExists(page, packageNls.lightning_generate_lwc_text, 120_000);
  });

  await test.step('create LWC via command palette', async () => {
    await executeCommandWithCommandPalette(page, packageNls.lightning_generate_lwc_text);

    const quickInput = activeQuickInputWidget(page);
    await quickInput.waitFor({ state: 'attached', timeout: 30_000 });

    // Step 1: Select template (built-in templates are pinned first: 'default', then 'typeScript', then others)
    await waitForQuickInputFirstOption(page);
    if (isContainer) {
      // Click the option rather than selectQuickInputOption — 1.116+ occasionally drops Enter on quick picks (PR #7193).
      // eslint-disable-next-line playwright/no-force-option -- quick-pick row re-renders on filter/highlight, invalidating the hover/actionability check
      await activeQuickInputWidget(page).getByRole('option').first().click({ force: true });
    } else {
      await saveScreenshot(page, 'step1.component-type-prompt-visible.png');
      await selectQuickInputOption(page, 'default');
      await saveScreenshot(page, 'step1.component-type-selected.png');
    }

    // Step 2: Enter component name
    await activeQuickInputWidget(page)
      .getByText(/Enter Lightning Web Component name/i)
      .waitFor({ state: 'attached', timeout: 10_000 });
    await page.keyboard.type(componentName);
    await page.keyboard.press('Enter');

    // Step 3: Select output directory (click first option instead of Enter)
    await waitForQuickInputFirstOption(page);
    const selectOutputDirectoryContainer = async (): Promise<void> => {
      // eslint-disable-next-line playwright/no-force-option -- quick-pick row re-renders on filter/highlight, invalidating the hover/actionability check
      await activeQuickInputWidget(page).getByRole('option').first().click({ force: true });
    };
    const selectOutputDirectoryDesktop = async (): Promise<void> => {
      const outputDirectory = activeQuickInputWidget(page).getByRole('option').first();
      await expect(outputDirectory).toBeVisible({ timeout: 10_000 });
      await outputDirectory.click();
    };
    await (isContainer ? selectOutputDirectoryContainer : selectOutputDirectoryDesktop)();

    // Step 4: Wait for editor to open with the new component
    await page.locator(EDITOR_WITH_URI).first().waitFor({ state: 'visible', timeout: 20_000 });
  });

  await test.step('verify component was created correctly', async () => {
    const editorTab = page.locator('[role="tab"]').filter({ hasText: new RegExp(`${componentName}\\.js`, 'i') });
    await expect(editorTab).toBeVisible({ timeout: 5000 });

    const explorerFolder = page
      .locator('[role="treeitem"]')
      .filter({ hasText: new RegExp(`${componentName}$`, 'i') })
      .first();
    await expect(explorerFolder).toBeVisible({ timeout: 5000 });

    const editorContent = page.locator(`[data-uri*="${componentName}.js"]`).first();
    await expect(editorContent).toBeVisible({ timeout: 5000 });

    const editorText = page.locator('.view-lines').first();
    await expect(editorText).toContainText('import { LightningElement }', { timeout: 5000 });

    // Explorer: folder auto-expanded when .js opened. Same on web, desktop, and container.
    await expect(page.getByRole('treeitem', { name: new RegExp(`${componentName}\\.html$`, 'i') })).toBeVisible({
      timeout: 5000
    });
    await expect(
      page.getByRole('treeitem', { name: new RegExp(`${componentName}\\.js-meta\\.xml$`, 'i') })
    ).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('treeitem', { name: '__tests__' })).toBeVisible({ timeout: 5000 });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
