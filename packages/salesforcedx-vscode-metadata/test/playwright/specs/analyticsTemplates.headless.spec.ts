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
  executeCommandWithCommandPalette,
  executeExplorerContextMenuCommand,
  validateNoCriticalErrors,
  saveScreenshot,
  activeQuickInputWidget,
  ensureSecondarySideBarHidden,
  waitForQuickInputFirstOption,
  isMacDesktop,
  EDITOR
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';

const expectedFiles = [
  'app-to-template-rules.json',
  'folder.json',
  'releaseNotes.html',
  'template-info.json',
  'template-to-app-rules.json',
  'ui.json',
  'variables.json'
] as const;

const enterTemplateName = async (page: Page, name: string) => {
  const quickInput = activeQuickInputWidget(page);
  await quickInput.waitFor({ state: 'visible', timeout: 30_000 });
  await page.keyboard.type(name);
  await page.keyboard.press('Enter');
};

const verifyGeneratedTemplate = async (page: Page, name: string) => {
  const editor = page.locator(`${EDITOR}[data-uri*="${name}/template-info.json"]`).first();
  await editor.waitFor({ state: 'visible', timeout: 30_000 });
  await expect(editor.getByText(`"name": "${name}"`), 'template-info.json should include template name').toBeVisible({
    timeout: 10_000
  });

  await executeCommandWithCommandPalette(page, 'File: Focus on Files Explorer');
  await Promise.all(
    expectedFiles.map(file =>
      expect(
        page
          .locator('[role="treeitem"]')
          .filter({ hasText: new RegExp(`${file}$`, 'i') })
          .first(),
        `${file} should be visible in explorer`
      ).toBeVisible({ timeout: 15_000 })
    )
  );
};

test('Analytics Templates: creates sample template via command palette and explorer context menu', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup workspace', async () => {
    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
  });

  await test.step('create analytics template via command palette', async () => {
    const name = `AnalyticsPalette${Date.now()}`;
    await verifyCommandExists(page, packageNls.analytics_generate_template_text, 30_000);
    await executeCommandWithCommandPalette(page, packageNls.analytics_generate_template_text);
    await enterTemplateName(page, name);
    await waitForQuickInputFirstOption(page);
    await page.keyboard.press('Enter');
    await verifyGeneratedTemplate(page, name);
    await saveScreenshot(page, `analytics-${name}-created.png`);
  });

  await test.step('create analytics template via explorer context menu', async step => {
    step.skip(isMacDesktop(), 'Explorer context menu not available on Mac Desktop');

    const name = `AnalyticsExplorer${Date.now()}`;
    await executeCommandWithCommandPalette(page, 'View: Close All Editors');
    await executeExplorerContextMenuCommand(page, /^waveTemplates$/, packageNls.analytics_generate_template_text);
    await enterTemplateName(page, name);
    await verifyGeneratedTemplate(page, name);
    await saveScreenshot(page, `analytics-${name}-created.png`);
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
