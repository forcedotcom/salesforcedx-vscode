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
  openFileByName,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  EDITOR_WITH_URI
} from '@salesforce/playwright-vscode-ext';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const VF_PAGE_CONTENT = `<apex:page controller="GoToDefController" tabStyle="Account">
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
    <label>GoToDefPage</label>
</ApexPage>`;

const APEX_CONTROLLER_CONTENT = `public class GoToDefController {
\tprivate final Account account;
\tpublic GoToDefController() {
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

test.describe('Visualforce LSP - Go to Definition', () => {
  test.beforeEach(async ({ page, workspaceDir }) => {
    setupConsoleMonitoring(page);
    setupNetworkMonitoring(page);

    const pagesDir = path.join(workspaceDir, 'force-app', 'main', 'default', 'pages');
    const classesDir = path.join(workspaceDir, 'force-app', 'main', 'default', 'classes');
    await fs.mkdir(pagesDir, { recursive: true });
    await fs.mkdir(classesDir, { recursive: true });

    await Promise.all([
      fs.writeFile(path.join(pagesDir, 'GoToDefPage.page'), VF_PAGE_CONTENT),
      fs.writeFile(path.join(pagesDir, 'GoToDefPage.page-meta.xml'), VF_PAGE_META),
      fs.writeFile(path.join(classesDir, 'GoToDefController.cls'), APEX_CONTROLLER_CONTENT),
      fs.writeFile(path.join(classesDir, 'GoToDefController.cls-meta.xml'), APEX_CONTROLLER_META)
    ]);

    await waitForVSCodeWorkbench(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await waitForWorkspaceReady(page);
    await waitForExtensionsActivated(page);
  });

  test('Go to Definition', async ({ page }) => {
    await openFileByName(page, 'GoToDefPage.page');
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="GoToDefPage.page"]`);
    await expect(editor).toBeVisible({ timeout: 15_000 });

    // Navigate to "GoToDefController" in controller="GoToDefController" (line 1, col 25)
    await page.keyboard.press('Control+g');
    await page.keyboard.type('1:25');
    await page.keyboard.press('Enter');

    // Use command palette — more reliable than F12 which can lose focus to notifications
    await executeCommandWithCommandPalette(page, 'Go to Definition');

    // Verify navigation to GoToDefController.cls
    const controllerEditor = page.locator(`${EDITOR_WITH_URI}[data-uri$="GoToDefController.cls"]`);
    await expect(controllerEditor).toBeVisible({ timeout: 15_000 });
  });

  test.afterEach(async ({ page }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);
    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  });
});
