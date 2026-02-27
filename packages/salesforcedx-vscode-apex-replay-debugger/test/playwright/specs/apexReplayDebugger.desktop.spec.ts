/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable unicorn/numeric-separators-style -- timeouts use numeric literals; rule conflicts for 4–5 digit values */
import { expect, type Page } from '@playwright/test';
import {
  clearOutputChannel,
  createApexClass,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  openFileByName,
  QUICK_INPUT_LIST_ROW,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';

import apexLogNls from 'salesforcedx-vscode-apex-log/package.nls.json';
import metadataNls from 'salesforcedx-vscode-metadata/package.nls.json';
import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';

/** Continue debug session (toolbar click or F5). Repeats until session ends (stopOnEntry + run-to-completion). */
const continueDebugSession = async (page: Page, maxContinues = 2): Promise<void> => {
  const toolbar = page.locator('.debug-toolbar');
  for (let i = 0; i < maxContinues; i++) {
    await toolbar.waitFor({ state: 'visible', timeout: 30000 });
    const continueBtn = toolbar.getByRole('button', { name: /Continue/ });
    const clicked = await continueBtn
      .click({ timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!clicked) break;
    // CI is slower; allow more time for session to end after Continue
    const sessionEnded = await expect(toolbar)
      .not.toBeVisible({ timeout: 45000 })
      .then(() => true)
      .catch(() => false);
    if (sessionEnded) break;
  }
  await expect(toolbar).not.toBeVisible({ timeout: 90000 });
};

test('Apex Replay Debugger: trace flag, exec anon, replay from log and test class', async ({
  page
}) => {
  test.setTimeout(600000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const exampleClassContent = [
    'public with sharing class ExampleApexClass {',
    '  public static void SayHello(string name){',
    '    System.debug(\'Hello, \' + name + \'!\');',
    '  }',
    '}'
  ].join('\n');

  const exampleTestContent = [
    '@IsTest',
    'public class ExampleApexClassTest {',
    '  @IsTest',
    '  static void validateSayHello() {',
    '    System.debug(\'Starting validate\');',
    '    ExampleApexClass.SayHello(\'Cody\');',
    '',
    '    System.assertEquals(1, 1, \'all good\');',
    '  }',
    '}'
  ].join('\n');

  await test.step('setup minimal org with ExampleApexClass and ExampleApexClassTest', async () => {
    await setupMinimalOrgAndAuth(page);
    await ensureSecondarySideBarHidden(page);
    await createApexClass(page, 'ExampleApexClass', exampleClassContent);
    await createApexClass(page, 'ExampleApexClassTest', exampleTestContent);
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await executeCommandWithCommandPalette(
      page,
      metadataNls.project_deploy_start_ignore_conflicts_default_org_text as string
    );
    await waitForOutputChannelText(page, { expectedText: 'Deploying', timeout: 30000 });
    await waitForOutputChannelText(page, { expectedText: 'deployed', timeout: 120000 });
    await saveScreenshot(page, 'setup.classes-created.png');
  });

  await test.step('wait for CodeLens in test class', async () => {
    // Apex LS must finish indexing before CodeLens appear; CI is slower
    const indexingComplete = page.getByRole('button', { name: /Indexing complete/ });
    await expect(indexingComplete).toBeVisible({ timeout: 120000 });
    await openFileByName(page, 'ExampleApexClassTest.cls');
    const codelens = page.locator('.codelens-decoration a').filter({ hasText: /Run Test|Debug Test/ });
    await expect(codelens.first()).toBeVisible({ timeout: 90000 });
    await saveScreenshot(page, 'step.codelens-visible.png');
  });

  await test.step('create trace flag for current user', async () => {
    await executeCommandWithCommandPalette(
      page,
      apexLogNls['apexLog.command.traceFlagsCreateForCurrentUser'] as string
    );
    const statusBar = page.getByRole('button', { name: /Tracing until/ });
    await expect(statusBar).toBeVisible({ timeout: 30000 });
  });

  await test.step('exec anon with selected text', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Apex Log');
    await clearOutputChannel(page);
    await openFileByName(page, 'ExampleApexClassTest.cls');

    // Use Control+G shortcut (no workbench.click) so editor retains focus throughout
    await page.keyboard.press('Control+g');
    await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'visible', timeout: 5000 });
    await page.keyboard.type('6');
    await page.keyboard.press('Enter');
    // Wait for Go to Line prompt to close before selecting (ensures editor has focus)
    await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'hidden', timeout: 5000 });

    // Select line content with keyboard — editor is now focused
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');

    // Open palette via F1 only (no workbench.click) to preserve editorHasSelection for the when condition
    await page.keyboard.press('F1');
    const execSelWidget = page.locator(QUICK_INPUT_WIDGET);
    await execSelWidget.waitFor({ state: 'visible', timeout: 10000 });
    await page.keyboard.type(apexLogNls['apexLog.command.executeSelection'] as string);
    await expect(execSelWidget.locator(QUICK_INPUT_LIST_ROW).first()).toBeAttached({ timeout: 10000 });
    await execSelWidget
      .locator(QUICK_INPUT_LIST_ROW)
      .filter({ hasText: /^SFDX: Execute Anonymous Apex with Editor's Selected Text/ })
      .first()
      .evaluate(el => {
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        (el as HTMLElement).click();
      });

    const logTab = page.locator('.tab').filter({ hasText: /\.log$/ });
    await expect(logTab).toBeVisible({ timeout: 30000 });
    await saveScreenshot(page, 'step.exec-anon-done.png');
  });

  await test.step('launch replay debugger with current file (log)', async () => {
    // Click the debug.log tab directly to make it the active editor.
    // launchApexReplayDebuggerWithCurrentFile reads activeTextEditor and only calls
    // updateLastOpened (setting LAST_OPENED_LOG_KEY) when the active file is a .log file.
    // Without LAST_OPENED_LOG_KEY, "launch from last log file" opens the native file picker.
    const logTab = page.locator('.tab').filter({ hasText: /debug\.log/ });
    await logTab.click({ force: true });
    await executeCommandWithCommandPalette(
      page,
      packageNls.launch_apex_replay_debugger_with_selected_file as string
    );
    await continueDebugSession(page);
  });

  await test.step('launch replay debugger with last log file', async () => {
    await executeCommandWithCommandPalette(page, packageNls.launch_from_last_log_file as string);
    await continueDebugSession(page);
  });

  await test.step('launch replay debugger with test class', async () => {
    await openFileByName(page, 'ExampleApexClassTest.cls');
    await executeCommandWithCommandPalette(
      page,
      packageNls.launch_apex_replay_debugger_with_selected_file as string
    );
    await continueDebugSession(page);
  });

  await test.step('exec anon with editor contents', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Apex Log');
    await clearOutputChannel(page);

    await executeCommandWithCommandPalette(
      page,
      apexLogNls['apexLog.command.createAnonymousApexScript'] as string
    );
    await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'visible', timeout: 10000 });
    await page.keyboard.type('TestScript');
    await page.keyboard.press('Enter');

    // Wait for TestScript.apex to be opened, then ensure it's the active editor
    await page.locator('.tab').filter({ hasText: /TestScript\.apex/ }).waitFor({ state: 'visible', timeout: 15000 });
    await openFileByName(page, 'TestScript.apex');

    await executeCommandWithCommandPalette(
      page,
      apexLogNls['apexLog.command.executeDocument'] as string
    );

    await saveScreenshot(page, 'step.exec-anon-document-done.png');
  });

  await test.step('turn off trace flag', async () => {
    await executeCommandWithCommandPalette(
      page,
      apexLogNls['apexLog.command.traceFlagsDeleteForCurrentUser'] as string
    );
    const statusBar = page.getByRole('button', { name: /No Tracing/ });
    await expect(statusBar).toBeVisible({ timeout: 30000 });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
