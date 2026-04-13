/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test } from '../fixtures';
import { expect } from '@playwright/test';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  waitForWorkspaceReady,
  waitForExtensionsActivated,
  closeWelcomeTabs,
  validateNoCriticalErrors,
  saveScreenshot,
  openFileByName,
  ensureSecondarySideBarHidden,
  EDITOR_WITH_URI
} from '@salesforce/playwright-vscode-ext';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const VF_PAGE_CONTENT = `<apex:page tabStyle="Account">
\t<apex:form>

\t\t<apex:pageBlock title="Hello">
\t\t\t<apex:commandButton value="Go"/>
\t\t</apex:pageBlock>
\t</apex:form>
</apex:page>`;

const VF_PAGE_META = `<?xml version="1.0" encoding="UTF-8"?>
<ApexPage xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>64.0</apiVersion>
    <label>AutocompletePage</label>
</ApexPage>`;

test.describe('Visualforce LSP - Autocompletion', () => {
  test.beforeEach(async ({ page, workspaceDir }) => {
    setupConsoleMonitoring(page);
    setupNetworkMonitoring(page);

    const pagesDir = path.join(workspaceDir, 'force-app', 'main', 'default', 'pages');
    await fs.mkdir(pagesDir, { recursive: true });

    await Promise.all([
      fs.writeFile(path.join(pagesDir, 'AutocompletePage.page'), VF_PAGE_CONTENT),
      fs.writeFile(path.join(pagesDir, 'AutocompletePage.page-meta.xml'), VF_PAGE_META)
    ]);

    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
    await waitForExtensionsActivated(page);
  });

  test('Autocompletion', async ({ page }) => {
    await test.step('Open AutocompletePage.page', async () => {
      await openFileByName(page, 'AutocompletePage.page');
      const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="AutocompletePage.page"]`);
      await expect(editor).toBeVisible({ timeout: 15_000 });
      await saveScreenshot(page, 'vf-lsp-file-opened.png');
    });

    await test.step('Type partial tag and verify autocomplete', async () => {
      // Move to end of line 2 (<apex:form>) and press Enter for a new line
      await page.keyboard.press('Control+g');
      await page.keyboard.type('3');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Home');

      // Type partial Visualforce tag
      await page.keyboard.type('\t\t<apex:pageM');

      // Trigger autocomplete explicitly (language server may need a nudge)
      await page.keyboard.press('Control+Space');

      // Wait for the suggest widget to appear (30s timeout for language server cold-start)
      const suggestWidget = page.locator('.editor-widget.suggest-widget');
      await expect(suggestWidget).toBeVisible({ timeout: 30_000 });

      // Verify apex:pageMessage appears in suggestions
      const suggestion = suggestWidget.locator('.monaco-list-row');
      await expect(suggestion.first()).toContainText('apex:pageMessage');
      await saveScreenshot(page, 'vf-lsp-autocomplete.png');
    });

    await test.step('Select autocomplete suggestion and verify insertion', async () => {
      // Select the first suggestion
      await page.keyboard.press('Enter');

      // Verify the suggestion was inserted
      const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="AutocompletePage.page"]`);
      const viewLines = editor.locator('.view-line');
      // Look for a line containing the inserted tag
      await expect(viewLines.filter({ hasText: 'apex:pageMessage' })).toBeVisible({ timeout: 5000 });
      await saveScreenshot(page, 'vf-lsp-autocomplete-inserted.png');
    });
  });

  test.afterEach(async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);
    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  });
});
