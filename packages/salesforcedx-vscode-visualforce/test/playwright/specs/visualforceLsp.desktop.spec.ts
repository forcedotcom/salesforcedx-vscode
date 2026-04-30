/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  EDITOR_WITH_URI,
  openFileByName,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForVSCodeWorkbench
} from '@salesforce/playwright-vscode-ext';
import { test } from '../fixtures';

const FOO_PAGE_NAME = 'FooPage.page';

const FOO_PAGE_CONTENT = `<apex:page controller="myController" tabStyle="Account">
\t<apex:form>
\t
\t\t<apex:pageBlock title="Congratulations {!$User.FirstName}">
\t\t\tYou belong to Account Name: <apex:inputField value="{!account.name}"/>
\t\t\t<apex:commandButton action="{!save}" value="save"/>
\t\t</apex:pageBlock>
\t</apex:form>
</apex:page>`;

const MY_CONTROLLER_CONTENT = `public class MyController {
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

test.describe('Visualforce LSP', () => {
  test.beforeEach(async ({ page, workspaceDir }) => {
    setupConsoleMonitoring(page);
    setupNetworkMonitoring(page);

    const classesDir = path.join(workspaceDir, 'force-app', 'main', 'default', 'classes');
    const pagesDir = path.join(workspaceDir, 'force-app', 'main', 'default', 'pages');

    await Promise.all([fs.mkdir(classesDir, { recursive: true }), fs.mkdir(pagesDir, { recursive: true })]);

    await Promise.all([
      fs.writeFile(path.join(classesDir, 'MyController.cls'), MY_CONTROLLER_CONTENT),
      fs.writeFile(path.join(pagesDir, FOO_PAGE_NAME), FOO_PAGE_CONTENT)
    ]);

    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'setup.complete.png');
  });

  // TODO: go to definition is not working in the VF language server
  test.skip('Go to Definition', async ({ page }) => {
    await openFileByName(page, FOO_PAGE_NAME);
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${FOO_PAGE_NAME}"]`);
    await editor.click();
    await page.keyboard.press('F12');
  });

  test('Autocompletion', async ({ page }) => {
    await openFileByName(page, FOO_PAGE_NAME);

    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${FOO_PAGE_NAME}"]`);
    await editor.waitFor({ state: 'visible', timeout: 15_000 });
    // Wait for the editor content to render before interacting
    await editor.locator('.view-line').first().waitFor({ state: 'visible', timeout: 10_000 });
    await editor.click();

    // Navigate to line 3 col 1 with Ctrl+G (Go to Line — reliable on all platforms)
    await page.keyboard.press('Control+g');
    await page.keyboard.type('3:1');
    await page.keyboard.press('Enter');

    // Type a partial apex tag to trigger completions
    await page.keyboard.type('<apex:pageM');

    // Explicitly trigger IntelliSense — language server may still be initializing
    await page.keyboard.press('Control+Space');

    // Wait for the suggest widget (allow up to 20s for LSP to start and respond)
    const suggestWidget = page.locator('.suggest-widget');
    await suggestWidget.waitFor({ state: 'visible', timeout: 20_000 });

    const firstSuggestion = suggestWidget.locator('.monaco-list-row').first();
    await firstSuggestion.waitFor({ state: 'visible', timeout: 10_000 });
    const ariaLabel = await firstSuggestion.getAttribute('aria-label');
    expect(ariaLabel).toContain('apex:pageMessage');

    await saveScreenshot(page, 'autocompletion.suggestions.png');

    // Accept the suggestion
    await firstSuggestion.click();
    await page.keyboard.press('Control+s');

    // Verify the inserted text appears in the editor
    const insertedLine = editor.locator('.view-line').filter({ hasText: 'apex:pageMessage' }).first();
    await expect(insertedLine).toBeVisible({ timeout: 10_000 });

    await saveScreenshot(page, 'autocompletion.inserted.png');
  });

  test.afterEach(async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);
    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  });
});
