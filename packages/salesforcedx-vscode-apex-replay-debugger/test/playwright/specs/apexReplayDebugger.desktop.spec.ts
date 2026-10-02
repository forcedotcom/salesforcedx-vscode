/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from '@playwright/test';
import {
  APEX_TRACE_FLAG_STATUS_BAR,
  clearOutputChannel,
  continueDebugSession,
  createAndOpenApexScript,
  createApexClass,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  NOTIFICATION_LIST_ITEM,
  openFileByName,
  QUICK_INPUT_WIDGET,
  removeAllDebugLevels,
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
  selectQuickInputOptionByTyping,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  stopDebugSession,
  validateNoCriticalErrors,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';

import apexLogNls from 'salesforcedx-vscode-apex-log/package.nls.json';
import metadataNls from 'salesforcedx-vscode-metadata/package.nls.json';
import packageNls from '../../../package.nls.json';
import { isContainer, sharedTest as test } from '../fixtures';

// No org setup on the container's shared, persistent workbench — every test uses the boot (default)
// org, and editors/notifications are reset before each test rather than assuming a clean slate.
test.beforeEach(async ({ page }) => {
  if (isContainer) {
    await resetContainerWorkbench(page);
  }
});

// A leaked session would poison the next test on the container's shared workbench. Best-effort.
test.afterEach(async ({ page }) => {
  if (isContainer) {
    await stopDebugSession(page);
  }
});

test('Apex Replay Debugger: trace flag, exec anon, replay from log file, last log, and test class', async ({
  page
}) => {
  test.setTimeout(600_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Unique per-run names so the container's shared, persistent workbench never collides with a class
  // or script left by a prior run.
  const uid = Date.now().toString(36);
  const exampleClass = isContainer ? `ExampleApexClass_${uid}` : 'ExampleApexClass';
  const exampleTestClass = isContainer ? `ExampleApexClass_${uid}Test` : 'ExampleApexClassTest';
  const runScript = isContainer ? `RunExample_${uid}` : 'TestScript';

  const exampleClassContent = [
    `public with sharing class ${exampleClass} {`,
    '  public static void SayHello(string name){',
    "    System.debug('Hello, ' + name + '!');",
    '  }',
    '}'
  ].join('\n');

  // Annotations kept INLINE with their declarations: once the Apex LS is warm, a bare `@IsTest` line
  // typed into the code-server editor can have its trailing newline swallowed by a completion-accept,
  // merging it into the next line and producing invalid Apex.
  const exampleTestContent = isContainer
    ? [
        `@IsTest public class ${exampleTestClass} {`,
        '  @IsTest static void validateSayHello() {',
        "    System.debug('Starting validate');",
        `    ${exampleClass}.SayHello('Cody');`,
        "    System.assertEquals(1, 1, 'all good');",
        '  }',
        '}'
      ].join('\n')
    : [
        '@IsTest',
        `public class ${exampleTestClass} {`,
        '  @IsTest',
        '  static void validateSayHello() {',
        "    System.debug('Starting validate');",
        `    ${exampleClass}.SayHello('Cody');`,
        '',
        "    System.assertEquals(1, 1, 'all good');",
        '  }',
        '}'
      ].join('\n');

  await test.step('setup with the example class and its test', async () => {
    if (!isContainer) {
      await setupMinimalOrgAndAuth(page);
    }
    await ensureSecondarySideBarHidden(page);
    await createApexClass(page, exampleClass, exampleClassContent);
    await createApexClass(page, exampleTestClass, exampleTestContent);
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await executeCommandWithCommandPalette(
      page,
      metadataNls.project_deploy_start_ignore_conflicts_default_org_text as string
    );
    await waitForOutputChannelText(page, { expectedText: 'Starting metadata deployment', timeout: 90_000 });
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: 120_000 });
    await saveScreenshot(page, 'setup.classes-created.png');
  });

  await test.step('wait for CodeLens in test class', async () => {
    if (isContainer) {
      // The desktop "Indexing complete" status-bar button never renders in the code-server image, so
      // gate on the real indexing signal instead: the test class' CodeLens only appears once the LS
      // has indexed it.
      await openFileByName(page, `${exampleTestClass}.cls`);
    } else {
      // Apex LS must finish indexing before CodeLens appear; CI is slower
      const indexingComplete = page.getByRole('button', { name: /Indexing complete/ });
      await expect(indexingComplete).toBeVisible({ timeout: 120_000 });
      await openFileByName(page, `${exampleTestClass}.cls`);
    }
    const codelens = page.locator('.codelens-decoration a').filter({ hasText: /Run Test|Debug Test/ });
    await expect(codelens.first()).toBeVisible({ timeout: isContainer ? 120_000 : 90_000 });
    await saveScreenshot(page, 'step.codelens-visible.png');
  });

  await test.step('remove all debug levels so ReplayDebuggerLevels is auto-created', async () => {
    await removeAllDebugLevels(page);
  });

  await test.step('create trace flag for current user', async () => {
    await executeCommandWithCommandPalette(
      page,
      apexLogNls['apexLog.command.traceFlagsCreateForCurrentUser'] as string
    );
    const statusBar = page.locator(APEX_TRACE_FLAG_STATUS_BAR).filter({ hasText: /Tracing until/ });
    await expect(statusBar).toBeVisible({ timeout: 60_000 });
  });

  if (isContainer) {
    // Container drives the anon-script + "execute document" entry point to produce the log used by
    // the replay launches below — no manual line-selection needed. Desktop additionally exercises the
    // "execute selected text" entry point (see below) so both exec-anon paths get coverage.
    await test.step('exec anon that calls the class so the org captures a debug log', async () => {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Apex Log');
      await clearOutputChannel(page);

      await createAndOpenApexScript(page, { name: runScript, content: `${exampleClass}.SayHello('Cody');` });
      await executeCommandWithCommandPalette(page, apexLogNls['apexLog.command.executeDocument'] as string);

      const successNotification = page
        .locator(NOTIFICATION_LIST_ITEM)
        .filter({ hasText: /executed successfully/i })
        .first();
      await expect(successNotification).toBeVisible({ timeout: 30_000 });
      await successNotification.getByRole('button', { name: /Open Log/i }).click();
      const logTab = page.locator('.tab').filter({ hasText: /\.log$/ });
      await expect(logTab).toBeVisible({ timeout: 10_000 });
      await saveScreenshot(page, 'step.exec-anon-done.png');
    });
  } else {
    await test.step('exec anon with selected text', async () => {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Apex Log');
      await clearOutputChannel(page);
      await openFileByName(page, `${exampleTestClass}.cls`);

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
      await selectQuickInputOptionByTyping(page, apexLogNls['apexLog.command.executeSelection'] as string);

      const successNotification = page
        .locator(NOTIFICATION_LIST_ITEM)
        .filter({ hasText: /executed successfully/i })
        .first();
      await expect(successNotification).toBeVisible({ timeout: 30_000 });
      await successNotification.getByRole('button', { name: /Open Log/i }).click();
      const logTab = page.locator('.tab').filter({ hasText: /\.log$/ });
      await expect(logTab).toBeVisible({ timeout: 10_000 });
      await saveScreenshot(page, 'step.exec-anon-done.png');
    });
  }

  await test.step('launch replay debugger with current file (log)', async () => {
    // Click the debug.log tab directly to make it the active editor.
    // launchApexReplayDebuggerWithCurrentFile reads activeTextEditor and only calls
    // updateLastOpened (setting LAST_OPENED_LOG_KEY) when the active file is a .log file.
    // Without LAST_OPENED_LOG_KEY, "launch from last log file" opens the native file picker.
    const logTab = page.locator('.tab').filter({ hasText: /\.log$/ });
    await expect(logTab).toBeVisible({ timeout: 10_000 });
    if (isContainer) {
      // eslint-disable-next-line playwright/no-force-option -- browser-served (code-server) workbench tab intercepts pointer events; the desktop twin clicks this same tab without force
      await logTab.click({ force: true });
    } else {
      await logTab.click();
    }
    await executeCommandWithCommandPalette(page, packageNls.launch_apex_replay_debugger_with_selected_file as string);
    await continueDebugSession(page);
    await saveScreenshot(page, 'step.replay-from-log.png');
  });

  await test.step('launch replay debugger with last log file', async () => {
    await executeCommandWithCommandPalette(page, packageNls.launch_from_last_log_file as string);
    await continueDebugSession(page);
    await saveScreenshot(page, 'step.replay-from-last-log.png');
  });

  await test.step('launch replay debugger with test class', async () => {
    await openFileByName(page, `${exampleTestClass}.cls`);
    await executeCommandWithCommandPalette(page, packageNls.launch_apex_replay_debugger_with_selected_file as string);
    await continueDebugSession(page);
    await saveScreenshot(page, 'step.replay-from-test-class.png');
  });

  if (!isContainer) {
    // Container already exercised the "execute document" entry point above (its sole exec-anon
    // step); this covers it separately here so desktop gets both exec-anon paths.
    await test.step('exec anon with editor contents', async () => {
      await ensureOutputPanelOpen(page);
      await selectOutputChannel(page, 'Salesforce Apex Log');
      await clearOutputChannel(page);

      await createAndOpenApexScript(page, { name: runScript });

      await executeCommandWithCommandPalette(page, apexLogNls['apexLog.command.executeDocument'] as string);

      const docSuccessNotification = page
        .locator(NOTIFICATION_LIST_ITEM)
        .filter({ hasText: /executed successfully/i })
        .first();
      await expect(docSuccessNotification).toBeVisible({ timeout: 30_000 });
      await docSuccessNotification.getByRole('button', { name: /Open Log/i }).click();
      const docLogTab = page.locator('.tab').filter({ hasText: /\.log$/ });
      await expect(docLogTab).toBeVisible({ timeout: 10_000 });
      await saveScreenshot(page, 'step.exec-anon-document-done.png');
    });
  }

  await test.step('turn off trace flag', async () => {
    await executeCommandWithCommandPalette(
      page,
      apexLogNls['apexLog.command.traceFlagsDeleteForCurrentUser'] as string
    );
    const statusBar = page.locator(APEX_TRACE_FLAG_STATUS_BAR).filter({ hasText: /No Tracing/ });
    await expect(statusBar).toBeVisible({ timeout: 30_000 });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
