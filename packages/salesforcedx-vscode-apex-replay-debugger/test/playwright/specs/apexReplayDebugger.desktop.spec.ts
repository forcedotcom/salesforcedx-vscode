/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect, type Page } from '@playwright/test';
import {
  APEX_TRACE_FLAG_STATUS_BAR,
  clearOutputChannel,
  closeAllEditors,
  continueDebugSession,
  createAndOpenApexScript,
  createApexClass,
  EDITOR_WITH_URI,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  hidePanel,
  NOTIFICATION_LIST_ITEM,
  openFileByName,
  QUICK_INPUT_WIDGET,
  removeAllDebugLevels,
  removePathsInContainer,
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
import { unlink } from 'node:fs/promises';
import { join, posix } from 'node:path';

import apexLogNls from 'salesforcedx-vscode-apex-log/package.nls.json';
import metadataNls from 'salesforcedx-vscode-metadata/package.nls.json';
import packageNls from '../../../package.nls.json';
import { isContainer, sharedWorkspaceDirTest as test } from '../fixtures';

/*
 * Container-only: the container name and the CONTAINER side of the fixture bind mount, published by
 * the orchestrator (scripts/codeBuilderLocalE2E.ts). Classes created through the workbench are owned
 * by the container's `codebuilder` user, so deleting one from the host side fails; it's removed
 * inside the container instead.
 */
const containerName = process.env.CB_CONTAINER_NAME;
const fixtureContainerDir = process.env.CB_FIXTURE_CONTAINER_DIR;

const removeWorkspaceClass = async (workspaceDir: string, className: string): Promise<void> => {
  const classesDir = ['force-app', 'main', 'default', 'classes'];
  if (!isContainer) {
    const hostClassPath = join(workspaceDir, ...classesDir, `${className}.cls`);
    await unlink(hostClassPath);
    await unlink(`${hostClassPath}-meta.xml`);
    return;
  }
  if (!containerName || !fixtureContainerDir) {
    throw new Error(
      'CB_CONTAINER_NAME / CB_FIXTURE_CONTAINER_DIR is not set — the orchestrator ' +
        '(scripts/codeBuilderLocalE2E.ts) must publish them so the spec can delete a class inside the container.'
    );
  }
  const classPath = posix.join(fixtureContainerDir, ...classesDir, `${className}.cls`);
  removePathsInContainer(containerName, [classPath, `${classPath}-meta.xml`]);
};

const clearApexLogChannel = async (page: Page): Promise<void> => {
  await ensureOutputPanelOpen(page);
  await selectOutputChannel(page, 'Salesforce Apex Log');
  await clearOutputChannel(page);
};

/** After an exec-anon run: wait for its success notification, open the log, and wait for the log tab. */
const openExecAnonLog = async (page: Page, screenshotName: string): Promise<void> => {
  const successNotification = page
    .locator(NOTIFICATION_LIST_ITEM)
    .filter({ hasText: /executed successfully/i })
    .first();
  await expect(successNotification).toBeVisible({ timeout: 30_000 });
  await successNotification.getByRole('button', { name: /Open Log/i }).click();
  await expect(page.locator('.tab').filter({ hasText: /\.log$/ })).toBeVisible({ timeout: 10_000 });
  await saveScreenshot(page, screenshotName);
};

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
  page,
  workspaceDir
}) => {
  test.setTimeout(600_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Unique per-run names so the container's shared, persistent workbench never collides with a class
  // or script left by a prior run.
  const uid = Date.now().toString(36);
  const exampleClass = `ExampleApexClass_${uid}`;
  const exampleTestClass = `ExampleApexClass_${uid}Test`;
  const runScript = `RunExample_${uid}`;
  const orgOnlyClass = `OrgOnlyReplayClass_${uid}`;

  const exampleClassContent = [
    `public with sharing class ${exampleClass} {`,
    '  public static void SayHello(string name){',
    `    ${orgOnlyClass}.run();`,
    "    System.debug('Hello, ' + name + '!');",
    '  }',
    '}'
  ].join('\n');

  // Annotations kept INLINE with their declarations: once the Apex LS is warm, a bare `@IsTest` line
  // typed into the code-server editor can have its trailing newline swallowed by a completion-accept,
  // merging it into the next line and producing invalid Apex.
  const exampleTestContent = [
    `@IsTest public class ${exampleTestClass} {`,
    '  @IsTest static void validateSayHello() {',
    "    System.debug('Starting validate');",
    `    ${exampleClass}.SayHello('Cody');`,
    "    System.assertEquals(1, 1, 'all good');",
    '  }',
    '}'
  ].join('\n');
  // The line of exampleTestContent the "execute selected text" step selects and runs.
  const sayHelloLine = 4;

  await test.step('setup with the example class and its test', async () => {
    if (!isContainer) {
      await setupMinimalOrgAndAuth(page);
    }
    await ensureSecondarySideBarHidden(page);
    await createApexClass(page, exampleClass, exampleClassContent);
    await createApexClass(
      page,
      orgOnlyClass,
      [
        `public class ${orgOnlyClass} {`,
        '  public static void run() {',
        "    System.debug('org-only replay source');",
        '  }',
        '}'
      ].join('\n')
    );
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
    await openFileByName(page, `${exampleTestClass}.cls`);
    // Apex LS must finish indexing before CodeLens appear; CI is slower. The Apex language-status
    // "Indexing complete" button renders only while an Apex editor is active (the test class above is).
    await expect(page.getByRole('button', { name: /Indexing complete/ })).toBeVisible({ timeout: 120_000 });
    const codelens = page.locator('.codelens-decoration a').filter({ hasText: /Run Test|Debug Test/ });
    await expect(codelens.first()).toBeVisible({ timeout: 120_000 });
    await saveScreenshot(page, 'step.codelens-visible.png');
  });

  await test.step('remove the deployed org-only class from the workspace', async () => {
    await closeAllEditors(page);
    await removeWorkspaceClass(workspaceDir, orgOnlyClass);
    await expect(
      page.getByRole('treeitem', { name: `${orgOnlyClass}.cls`, exact: true }),
      'org-only source must not remain in the workspace'
    ).toHaveCount(0);
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

  // This step's log (it runs SayHello, which calls the org-only class) is the one the replay steps below use.
  await test.step('exec anon with selected text', async () => {
    await clearApexLogChannel(page);
    await openFileByName(page, `${exampleTestClass}.cls`);

    // Use Control+G shortcut (no workbench.click) so editor retains focus throughout
    await page.keyboard.press('Control+g');
    await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'visible', timeout: 5000 });
    await page.keyboard.type(String(sayHelloLine));
    await page.keyboard.press('Enter');
    // Wait for Go to Line prompt to close before selecting (ensures editor has focus)
    await page.locator(QUICK_INPUT_WIDGET).waitFor({ state: 'hidden', timeout: 5000 });

    // Select line content with keyboard — editor is now focused
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+End');

    // Open palette via F1 only (no workbench.click) to preserve editorHasSelection for the when condition
    await page.keyboard.press('F1');
    await selectQuickInputOptionByTyping(page, apexLogNls['apexLog.command.executeSelection'] as string);

    await openExecAnonLog(page, 'step.exec-anon-done.png');
  });

  await test.step('set a workspace breakpoint before the org-only call', async () => {
    await openFileByName(page, `${exampleClass}.cls`);
    const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${exampleClass}.cls"]`);
    await editor
      .locator('.view-line')
      .filter({ hasText: `${orgOnlyClass}.run();` })
      .click();
    await page.keyboard.press('F9');
    await expect(
      page.locator('div.codicon-debug-breakpoint').first(),
      'workspace breakpoint should be set'
    ).toBeVisible();
  });

  await test.step('launch replay from the log and open the matching org-only frame source', async () => {
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
    await hidePanel(page);
    await executeCommandWithCommandPalette(page, packageNls.launch_apex_replay_debugger_with_selected_file as string);
    await expect(page.locator('.debug-toolbar'), 'replay should pause on entry').toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('F5');
    const localFrame = page
      .locator('.debug-call-stack .monaco-list-row')
      .filter({ hasText: `${exampleClass}.SayHello` });
    await expect(localFrame.first(), 'replay should stop before the org-only call').toBeVisible({ timeout: 30_000 });
    // Step Into: code-server binds it to Alt+F11 because the browser reserves F11 for fullscreen.
    await page.keyboard.press(isContainer ? 'Alt+F11' : 'F11');
    const orgFrame = page
      .locator('.debug-call-stack .monaco-list-row')
      .filter({ hasText: `${orgOnlyClass}.${orgOnlyClass}()` });
    await orgFrame.click();
    const orgEditor = page.locator(`${EDITOR_WITH_URI}[data-uri^="sf-org-metadata:"]`);
    await expect(orgEditor, 'stack frame should open the catalog URI for the org-only class').toHaveAttribute(
      'data-uri',
      new RegExp(String.raw`^sf-org-metadata:\/orgs\/00D\w+\/ApexClass\/${orgOnlyClass}\.cls$`),
      { timeout: 30_000 }
    );
    await expect(orgEditor, 'catalog source should contain the deployed class body').toContainText(
      "System.debug('org-only replay source');"
    );
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

  await test.step('exec anon with editor contents', async () => {
    await clearApexLogChannel(page);
    await createAndOpenApexScript(page, { name: runScript });
    await executeCommandWithCommandPalette(page, apexLogNls['apexLog.command.executeDocument'] as string);
    await openExecAnonLog(page, 'step.exec-anon-document-done.png');
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
