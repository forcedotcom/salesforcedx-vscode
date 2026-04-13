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
  closeWelcomeTabs,
  validateNoCriticalErrors,
  saveScreenshot,
  openFileByName,
  ensureSecondarySideBarHidden,
  EDITOR_WITH_URI
} from '@salesforce/playwright-vscode-ext';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const VF_PAGE_CONTENT = `<apex:page controller="MyController" tabStyle="Account">
\t<apex:form>

\t\t<apex:pageBlock title="Congratulations {!$User.FirstName}">
\t\t\tYou belong to Account Name: <apex:inputField value="{!account.name}"/>
\t\t\t<apex:commandButton action="{!save}" value="save"/>
\t\t</apex:pageBlock>
\t</apex:form>
</apex:page>`;

const VF_PAGE_META = `<?xml version="1.0" encoding="UTF-8"?>
<ApexPage xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>64.0</apiVersion>
    <label>FooPage</label>
</ApexPage>`;

const APEX_CONTROLLER_CONTENT = `public class MyController {
\tprivate final Account account;
\tpublic MyController() {
\t\taccount = [SELECT Id, Name, Phone, Site FROM Account
\t\tWHERE Id = :ApexPages.currentPage().getParameters().get('id')];
\t}
\tpublic Account getAccount() {
\t\treturn account;
\t}
\tpublic PageReference save() {
\t\tupdate account;
\t\treturn null;
\t}
}`;

const APEX_CONTROLLER_META = `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
    <apiVersion>64.0</apiVersion>
    <status>Active</status>
</ApexClass>`;

test.describe('Visualforce LSP', () => {
  test.beforeEach(async ({ page, workspaceDir }) => {
    setupConsoleMonitoring(page);
    setupNetworkMonitoring(page);

    const pagesDir = path.join(workspaceDir, 'force-app', 'main', 'default', 'pages');
    const classesDir = path.join(workspaceDir, 'force-app', 'main', 'default', 'classes');
    await fs.mkdir(pagesDir, { recursive: true });
    await fs.mkdir(classesDir, { recursive: true });

    await Promise.all([
      fs.writeFile(path.join(pagesDir, 'FooPage.page'), VF_PAGE_CONTENT),
      fs.writeFile(path.join(pagesDir, 'FooPage.page-meta.xml'), VF_PAGE_META),
      fs.writeFile(path.join(classesDir, 'MyController.cls'), APEX_CONTROLLER_CONTENT),
      fs.writeFile(path.join(classesDir, 'MyController.cls-meta.xml'), APEX_CONTROLLER_META)
    ]);

    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
  });

  test('Autocompletion', async ({ page }) => {
    await test.step('Open FooPage.page', async () => {
      await openFileByName(page, 'FooPage.page');
      const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="FooPage.page"]`);
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
      const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="FooPage.page"]`);
      const viewLines = editor.locator('.view-line');
      // Look for a line containing the inserted tag
      await expect(viewLines.filter({ hasText: 'apex:pageMessage' })).toBeVisible({ timeout: 5000 });
      await saveScreenshot(page, 'vf-lsp-autocomplete-inserted.png');
    });
  });

  // TODO: Go to Definition is not working — see original WDIO test
  test.skip('Go to Definition', async ({ page }) => {
    await openFileByName(page, 'FooPage.page');
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="FooPage.page"]`);
    await expect(editor).toBeVisible({ timeout: 15_000 });

    // Navigate to the controller reference and trigger Go to Definition
    await page.keyboard.press('Control+g');
    await page.keyboard.type('1');
    await page.keyboard.press('Enter');

    // Position cursor on "MyController" (column 25)
    // Then F12 for Go to Definition
    await page.keyboard.press('F12');

    // Verify navigation to MyController.cls
    const controllerEditor = page.locator(`${EDITOR_WITH_URI}[data-uri$="MyController.cls"]`);
    await expect(controllerEditor).toBeVisible({ timeout: 15_000 });
  });

  test.afterEach(async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);
    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  });
});
