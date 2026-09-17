/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container twin of apexReplayDebugger.desktop (ADR 0022, W-23898526). Covers the MULTI-LAUNCH flow
 * distinct from debugAnonymousApex.container: create a trace flag, exec anon to produce a standalone
 * `.log`, then launch a replay session from three different entry points —
 *   - "Launch with Selected File" on the `.log` file
 *   - "Launch with Last Log File"
 *   - "Launch with Selected File" on a test `.cls`
 * — continuing each to completion, then delete the trace flag. Runs against the container's boot
 * (default target) org; per-test org creation is dropped. Hardened for the shared, persistent
 * workbench: unique per-run class/script names, a beforeEach reset, and an afterEach that stops any
 * leaked session.
 */

import { expect } from '@playwright/test';
import {
  activateEditorTab,
  APEX_TRACE_FLAG_STATUS_BAR,
  clearOutputChannel,
  continueDebugSession,
  createApexClass,
  createAndOpenApexScript,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  NOTIFICATION_LIST_ITEM,
  removeAllDebugLevels,
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  stopDebugSession,
  validateNoCriticalErrors,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';

import apexLogNls from 'salesforcedx-vscode-apex-log/package.nls.json';
import metadataNls from 'salesforcedx-vscode-metadata/package.nls.json';
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

test.beforeEach(async ({ page }) => {
  await resetContainerWorkbench(page);
});

test.afterEach(async ({ page }) => {
  await stopDebugSession(page);
});

test('Apex Replay Debugger (Code Builder): trace flag, exec anon, replay from log file, last log, and test class', async ({
  page
}) => {
  test.setTimeout(600_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const uid = Date.now().toString(36);
  const exampleClass = `ExampleApexClass_${uid}`;
  const exampleTestClass = `ExampleApexClass_${uid}Test`;
  const runScript = `RunExample_${uid}`;

  const exampleClassContent = [
    `public with sharing class ${exampleClass} {`,
    '  public static void SayHello(string name){',
    "    System.debug('Hello, ' + name + '!');",
    '  }',
    '}'
  ].join('\n');

  // Annotations kept INLINE with their declarations: once the Apex LS is warm, a bare `@IsTest` line
  // typed into the code-server editor can have its trailing newline swallowed by a completion-accept,
  // merging it into the next line and producing invalid Apex. Inlining avoids that.
  const exampleTestContent = [
    `@IsTest public class ${exampleTestClass} {`,
    '  @IsTest static void validateSayHello() {',
    "    System.debug('Starting validate');",
    `    ${exampleClass}.SayHello('Cody');`,
    "    System.assertEquals(1, 1, 'all good');",
    '  }',
    '}'
  ].join('\n');

  await test.step('deploy an Apex class and its test to the boot org', async () => {
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
    await saveScreenshot(page, 'setup.classes-deployed.png');
  });

  await test.step('wait for Apex LS indexing to complete', async () => {
    // Apex LS must finish indexing before the test-class launch resolves the class name; CI is slower.
    // The desktop "Indexing complete" status-bar button never renders in the code-server image, so
    // gate on the real indexing signal instead: the test class' CodeLens (Run/Debug Test) only
    // appears once the LS has indexed it.
    await activateEditorTab(page, `${exampleTestClass}.cls`);
    const codelens = page.locator('.codelens-decoration a').filter({ hasText: /Run Test|Debug Test/ });
    await expect(codelens.first()).toBeVisible({ timeout: 120_000 });
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

  await test.step('launch replay with the selected .log file', async () => {
    // Click the .log tab directly so it is the active editor: launchApexReplayDebuggerWithCurrentFile
    // reads activeTextEditor and only sets LAST_OPENED_LOG_KEY when the active file is a .log — the
    // key the next "launch from last log file" step relies on.
    const logTab = page.locator('.tab').filter({ hasText: /\.log$/ });
    await logTab.click({ force: true });
    await executeCommandWithCommandPalette(page, packageNls.launch_apex_replay_debugger_with_selected_file as string);
    await continueDebugSession(page);
    await saveScreenshot(page, 'step.replay-from-log.png');
  });

  await test.step('launch replay with the last log file', async () => {
    await executeCommandWithCommandPalette(page, packageNls.launch_from_last_log_file as string);
    await continueDebugSession(page);
    await saveScreenshot(page, 'step.replay-from-last-log.png');
  });

  await test.step('launch replay with the test class', async () => {
    await activateEditorTab(page, `${exampleTestClass}.cls`);
    await executeCommandWithCommandPalette(page, packageNls.launch_apex_replay_debugger_with_selected_file as string);
    await continueDebugSession(page);
    await saveScreenshot(page, 'step.replay-from-test-class.png');
  });

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
