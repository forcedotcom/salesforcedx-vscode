/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test } from '../fixtures';
import { expect, type Page } from '@playwright/test';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady,
  verifyCommandExists,
  closeWelcomeTabs,
  closeAllEditors,
  executeCommandWithCommandPalette,
  validateNoCriticalErrors,
  saveScreenshot,
  activeQuickInputWidget,
  EDITOR_WITH_URI,
  ensureSecondarySideBarHidden,
  waitForQuickInputFirstOption
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';

// Single cross-platform source of truth for Visualforce template generation.
// Runs on desktop (playwright.config.desktop.ts globs specs/) AND web (playwright.config.web.ts) —
// the `../fixtures` index resolves `test` to the desktop or web fixture by VSCODE_DESKTOP.

test.describe('Visualforce Templates', () => {
  test.beforeEach(async ({ page }) => {
    setupConsoleMonitoring(page);
    setupNetworkMonitoring(page);
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
  });

  // Generate a VF template via command palette → name → output-dir, then assert the generated file
  // opens in an editor (opening `.page`/`.component` triggers `onLanguage:visualforce` activation)
  // and both files land in the explorer. Shared memfs workspace across web tests → close editors first.
  const createVisualforceTemplate = async (page: Page, command: string, name: string, extension: string) => {
    await test.step(`Create Visualforce ${name}`, async () => {
      await closeAllEditors(page);
      await verifyCommandExists(page, command, 30_000);
      await executeCommandWithCommandPalette(page, command);

      const quickInput = activeQuickInputWidget(page);
      await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
      await page.keyboard.type(name);
      await page.keyboard.press('Enter');

      await waitForQuickInputFirstOption(page);
      await page.keyboard.press('Enter');

      const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${name}.${extension}"]`);
      await editor.waitFor({ state: 'visible', timeout: 30_000 });

      await Promise.all(
        [`${name}.${extension}`, `${name}.${extension}-meta.xml`].map(file => {
          const explorerFile = page
            .locator('[role="treeitem"]')
            .filter({ hasText: new RegExp(`${file.replaceAll('.', '\\.')}$`, 'i') });
          return expect(explorerFile, `${file} should be visible in explorer`).toBeVisible({ timeout: 15_000 });
        })
      );
      await saveScreenshot(page, `vf-${name}-created.png`);
    });
  };

  test('Create Visualforce Page', async ({ page }) => {
    const name = `VFPage${Date.now()}`;
    await createVisualforceTemplate(page, packageNls.visualforce_generate_page_text, name, 'page');
  });

  test('Create Visualforce Component', async ({ page }) => {
    const name = `VFCmp${Date.now()}`;
    await createVisualforceTemplate(page, packageNls.visualforce_generate_component_text, name, 'component');
  });

  test.afterEach(async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);
    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  });
});
