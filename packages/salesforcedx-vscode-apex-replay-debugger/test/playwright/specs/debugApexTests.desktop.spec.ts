/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect, type Page } from '@playwright/test';
import {
  clearAllNotifications,
  clickCodeLens,
  continueDebugSession,
  createApexClass,
  EDITOR_WITH_URI,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  focusMonacoInput,
  NOTIFICATION_LIST_ITEM,
  openFileByName,
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  stopDebugSession,
  validateNoCriticalErrors,
  verifyNoTestRunInProgress,
  waitForOutputChannelText,
  WORKBENCH
} from '@salesforce/playwright-vscode-ext';

import apexTestingNls from 'salesforcedx-vscode-apex-testing/package.nls.json';
import metadataNls from 'salesforcedx-vscode-metadata/package.nls.json';
import { isContainer, sharedTest as test } from '../fixtures';

/**
 * Clicks a Test Explorer tree row's "Debug Test" action button using a bounded stale-row retry.
 * Clicking a tree row re-renders the tree (selection highlight + action buttons), invalidating element
 * refs, so retry the normal actions (force-clicking on the container's browser-served workbench, which
 * can intercept pointer events) to tolerate stale refs.
 */
const debugTestFromTreeItem = async (page: Page, name: RegExp): Promise<void> => {
  const item = page.getByRole('treeitem', { name });
  await item.waitFor({ state: 'visible', timeout: 30_000 });
  await expect(async () => {
    await item.click({ force: isContainer });
    await item.hover({ force: isContainer });
    const debugButton = item.getByRole('button', { name: /^Debug Test/ });
    await debugButton.waitFor({ state: 'visible', timeout: 3000 });
    await expect(debugButton).toBeEnabled({ timeout: 3000 });
    await debugButton.click({ force: isContainer });
  }).toPass({ timeout: 30_000 });
};

// Test Explorer builds a Namespace → Package → Class → Method hierarchy; unpackaged local classes
// nest under these two labels (apex-testing src/messages/i18n.ts). Collapsed parents virtualize their
// children, so class/method rows are not in the DOM until both parents are expanded.
const LOCAL_NAMESPACE_LABEL = '(Local Namespace)';
const UNPACKAGED_METADATA_LABEL = '(Unpackaged Metadata)';

/** Expand a Test Explorer tree row via its twistie if collapsed; 400ms settle matches apex-testing helper. */
const expandTreeRow = async (page: Page, rowLabel: string): Promise<void> => {
  const row = page.locator('[role="treeitem"]').filter({ hasText: rowLabel }).first();
  await row.waitFor({ state: 'visible', timeout: 15_000 });
  const twistie = row.locator('.monaco-tl-twistie');
  const collapsed = await twistie.evaluate(el => el.classList.contains('collapsed')).catch(() => false);
  if (!collapsed) return;
  if (isContainer) {
    // Twistie glyph is a zero-size pseudo-element on the container's browser-served workbench; the row
    // intercepts pointer events at its coordinates.
    // eslint-disable-next-line playwright/no-force-option -- see comment above
    await twistie.click({ force: true });
  } else {
    await expect(twistie).toBeVisible({ timeout: 5000 });
    await twistie.click();
  }
  await page.waitForTimeout(400);
};

/** Expand the (Local Namespace) → (Unpackaged Metadata) parents so class/method rows render. */
const expandNamespaceAndPackage = async (page: Page): Promise<void> => {
  await expandTreeRow(page, LOCAL_NAMESPACE_LABEL);
  await page
    .locator('[role="treeitem"]')
    .filter({ hasText: UNPACKAGED_METADATA_LABEL })
    .first()
    .waitFor({ state: 'visible', timeout: 10_000 });
  await expandTreeRow(page, UNPACKAGED_METADATA_LABEL);
};

/**
 * Runs `Test: Refresh Tests` and waits for the async tree rebuild. Discovery clears then rebuilds the
 * tree after the command returns — on Windows the empty-state ("No tests have been found...") renders
 * and any immediate follow-up tree interaction times out (mirrors apex-testing refreshTestsAndWaitForRebuild).
 */
const refreshTestsAndWaitForRebuild = async (page: Page): Promise<void> => {
  await executeCommandWithCommandPalette(page, 'Test: Refresh Tests');
  await page
    .getByText(LOCAL_NAMESPACE_LABEL)
    .first()
    .waitFor({ state: 'hidden', timeout: 2000 })
    .catch(() => {});
  await expect(page.getByText(LOCAL_NAMESPACE_LABEL).first()).toBeVisible({ timeout: 60_000 });
};

/**
 * Success notification suffix from the apex-testing NLS template `%s successfully ran`.
 * `%s` = `Debug Test(s)` (replay-debugger i18n `debug_test_exec_name`, not in any package.nls.json),
 * so match on the static `successfully ran` suffix rather than the interpolated full string.
 */
const SUCCESS_NOTIFICATION_SUFFIX = apexTestingNls.apex_test_successful_execution_message.replace('%s ', '');

const waitForSuccessNotification = async (page: Page): Promise<void> => {
  const successNotification = page
    .locator(NOTIFICATION_LIST_ITEM)
    .filter({ hasText: SUCCESS_NOTIFICATION_SUFFIX })
    .first();
  await expect(successNotification).toBeVisible({ timeout: 60_000 });
};

// replay-debugger i18n `debug_test_completed_with_failures_message` (not in any package.nls.json)
const FAILURE_NOTIFICATION_PATTERN = /Debug Test\(s\) completed with 1 failing test\(s\)/;

/** Open `fileName` and toggle a breakpoint (F9) on the first line containing `lineText`. */
const setBreakpoint = async (page: Page, fileName: string, lineText: string): Promise<void> => {
  await openFileByName(page, fileName);
  const editor = page.locator(`${EDITOR_WITH_URI}[data-uri$="${fileName}"]`);
  await editor.waitFor({ state: 'visible', timeout: 15_000 });
  const line = editor.locator('.view-line').filter({ hasText: lineText }).first();
  await expect(line).toBeVisible({ timeout: 15_000 });
  await line.click();
  await page.keyboard.press('F9');
  await expect(editor.locator('div.codicon-debug-breakpoint').first()).toBeVisible({ timeout: 15_000 });
};

/** Continue (F5) from a breakpoint once, focusing the editor first as continueDebugSession does. */
const continueFromBreakpoint = async (page: Page): Promise<void> => {
  await focusMonacoInput(page.locator(`${WORKBENCH} .editor-instance .monaco-editor`).first());
  await page.keyboard.press('F5');
};

/**
 * Debug every test class at once from the Test Explorer package row and step through each class'
 * replay. Desktop-only: the package row covers EVERY test class in the workspace, which on desktop is
 * exactly `testClasses`, but the container's shared, persistent workspace also holds the fixture's and
 * earlier specs' test classes, so neither the batch size nor the single-failure count is knowable there.
 */
const debugAllClassesViaPackageRow = async (page: Page, testClasses: readonly string[]): Promise<void> => {
  // A breakpoint per class pauses each replay, so the batch can't run past a log before it's checked
  for (const testClass of testClasses) {
    await setBreakpoint(page, `${testClass}.cls`, 'Starting validate');
  }
  await clearAllNotifications(page);
  await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
  await expandNamespaceAndPackage(page);
  await debugTestFromTreeItem(page, /\(Unpackaged Metadata\)/);
  await expect(
    page.locator(NOTIFICATION_LIST_ITEM).filter({ hasText: FAILURE_NOTIFICATION_PATTERN }).first()
  ).toBeVisible({ timeout: 180_000 });
  await expect(page.locator(NOTIFICATION_LIST_ITEM).filter({ hasText: SUCCESS_NOTIFICATION_SUFFIX })).toHaveCount(0);
  await executeCommandWithCommandPalette(page, 'View: Show Run and Debug');
  // One synchronous run, and so one log, per class: three logs replay in turn, each when the previous ends
  for (const [index, testClass] of testClasses.entries()) {
    const stackFrame = page.locator('.debug-call-stack .monaco-list-row').filter({ hasText: testClass });
    await expect(stackFrame.first()).toBeVisible({ timeout: 60_000 });
    // The progress toast may be hidden, so read the replay progress from the notification center
    await executeCommandWithCommandPalette(page, 'Notifications: Show Notifications');
    await expect(
      page
        .locator(NOTIFICATION_LIST_ITEM)
        .filter({ hasText: `${index + 1} of ${testClasses.length}: ${testClass}` })
        .first()
    ).toBeVisible({ timeout: 10_000 });
    // Leave the center as is: opening the command palette closes it, so "Hide Notifications" isn't offered,
    // and an open center doesn't block F5
    await (index < testClasses.length - 1 ? continueFromBreakpoint(page) : continueDebugSession(page));
  }
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

test('Debug Apex Tests: CodeLens and Test Explorer entry points', async ({ page }) => {
  test.setTimeout(600_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Unique per-run names so the container's shared, persistent workbench never collides with a class
  // left by a prior run (harmless on desktop's fresh workspace).
  const uid = Date.now().toString(36);
  const class1 = `ExampleApexClass1_${uid}`;
  const class1Test = `ExampleApexClass1_${uid}Test`;
  const class2 = `ExampleApexClass2_${uid}`;
  const class2Test = `ExampleApexClass2_${uid}Test`;

  const class1Content = [
    `public with sharing class ${class1} {`,
    '  public static void SayHello(string name){',
    "    System.debug('Hello, ' + name + '!');",
    '  }',
    '}'
  ].join('\n');

  // Annotations kept INLINE with their declarations: once the Apex LS is warm, a bare `@IsTest` line
  // typed into the code-server editor can have its trailing newline swallowed by a completion-accept,
  // merging it into the next line and producing invalid Apex. Same text on desktop, where it's equally valid.
  const class1TestContent = [
    `@IsTest public class ${class1Test} {`,
    '  @IsTest static void validateSayHello() {',
    "    System.debug('Starting validate');",
    `    ${class1}.SayHello('Cody');`,
    "    System.assertEquals(1, 1, 'all good');",
    '  }',
    '}'
  ].join('\n');

  const class2Content = [
    `public with sharing class ${class2} {`,
    '  public static void SayHello(string name){',
    "    System.debug('Hello, ' + name + '!');",
    '  }',
    '}'
  ].join('\n');

  // Distinct method name from class1Test so the Test Explorer treeitem label is unique (both classes
  // nest under the same Namespace/Package parents; a shared method name would match two virtualized
  // treeitem rows and trip Playwright strict mode).
  const class2TestContent = [
    `@IsTest public class ${class2Test} {`,
    '  @IsTest static void validateSayHelloTwo() {',
    "    System.debug('Starting validate');",
    `    ${class2}.SayHello('Cody');`,
    "    System.assertEquals(1, 1, 'all good');",
    '  }',
    '}'
  ].join('\n');

  // Fails on purpose: debugging a failing test still launches the replay debugger, but ends with the
  // failure notification instead of success.
  const failingTest = `ExampleFailingApexTest_${uid}`;
  const failingTestContent = [
    `@IsTest public class ${failingTest} {`,
    '  @IsTest static void validateFails() {',
    "    System.debug('Starting validate');",
    "    System.assertEquals(1, 2, 'expected failure');",
    '  }',
    '}'
  ].join('\n');

  await test.step('setup with two Apex classes, their tests, and a failing test', async () => {
    if (!isContainer) {
      await setupMinimalOrgAndAuth(page);
    }
    await ensureSecondarySideBarHidden(page);
    await createApexClass(page, class1, class1Content);
    await createApexClass(page, class1Test, class1TestContent);
    await createApexClass(page, class2, class2Content);
    await createApexClass(page, class2Test, class2TestContent);
    await createApexClass(page, failingTest, failingTestContent);
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await executeCommandWithCommandPalette(page, metadataNls.project_deploy_start_ignore_conflicts_default_org_text);
    await waitForOutputChannelText(page, { expectedText: 'Starting metadata deployment', timeout: 90_000 });
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: 120_000 });
    await saveScreenshot(page, 'setup.classes-created.png');
  });

  await test.step('wait for CodeLens in test class', async () => {
    await openFileByName(page, `${class1Test}.cls`);
    // Apex LS must finish indexing before CodeLens appear; CI is slower. The language-status button
    // renders only while an Apex editor is active, so wait after opening the test class.
    const indexingComplete = page.getByRole('button', { name: /Indexing complete/ });
    await expect(indexingComplete).toBeVisible({ timeout: 120_000 });
    const codelens = page.locator('.codelens-decoration a').filter({ hasText: /Run Test|Debug Test/ });
    await expect(codelens.first()).toBeVisible({ timeout: 120_000 });
    await saveScreenshot(page, 'step.codelens-visible.png');
  });

  await test.step('Debug All Tests via class-level CodeLens', async () => {
    await openFileByName(page, `${class1Test}.cls`);
    await clickCodeLens(page, 'Debug All Tests', { timeout: 180_000 });
    await waitForSuccessNotification(page);
    await continueDebugSession(page);
    await verifyNoTestRunInProgress(page);
    await saveScreenshot(page, 'step.debug-all-tests.png');
  });

  await test.step('Debug Test via method-level CodeLens', async () => {
    await openFileByName(page, `${class2Test}.cls`);
    await clickCodeLens(page, 'Debug Test', { timeout: 180_000 });
    await waitForSuccessNotification(page);
    await continueDebugSession(page);
    await verifyNoTestRunInProgress(page);
    await saveScreenshot(page, 'step.debug-single-test.png');
  });

  await test.step('Debug class via Test Explorer', async () => {
    await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
    // Refresh rebuilds the tree async; wait for rebuild then expand parents so class rows render
    await refreshTestsAndWaitForRebuild(page);
    await expandNamespaceAndPackage(page);
    await debugTestFromTreeItem(page, new RegExp(class1Test, 'i'));
    await waitForSuccessNotification(page);
    await continueDebugSession(page);
    await verifyNoTestRunInProgress(page);
    await saveScreenshot(page, 'step.debug-test-explorer-class.png');
  });

  await test.step('Debug method via Test Explorer', async () => {
    await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
    await expandNamespaceAndPackage(page);
    // Expand the class node to reveal its method, then debug the method row
    await expandTreeRow(page, class2Test);
    const methodItem = page.getByRole('treeitem', { name: /validateSayHelloTwo/i });
    await methodItem.waitFor({ state: 'visible', timeout: 30_000 });
    await debugTestFromTreeItem(page, /validateSayHelloTwo/i);
    await waitForSuccessNotification(page);
    await continueDebugSession(page);
    await verifyNoTestRunInProgress(page);
    await saveScreenshot(page, 'step.debug-test-explorer-method.png');
  });

  await test.step('Debug failing test via CodeLens shows the failure notification', async () => {
    // Clear the earlier steps' success toasts so the failing run's toast is checked against a clean list
    await clearAllNotifications(page);
    await openFileByName(page, `${failingTest}.cls`);
    await clickCodeLens(page, 'Debug All Tests', { timeout: 180_000 });
    await expect(
      page.locator(NOTIFICATION_LIST_ITEM).filter({ hasText: FAILURE_NOTIFICATION_PATTERN }).first()
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(NOTIFICATION_LIST_ITEM).filter({ hasText: SUCCESS_NOTIFICATION_SUFFIX })).toHaveCount(0);
    await continueDebugSession(page);
    await verifyNoTestRunInProgress(page);
    await saveScreenshot(page, 'step.debug-failing-test.png');
  });

  // Desktop-only — see debugAllClassesViaPackageRow.
  if (!isContainer) {
    await test.step('Debug all classes via Test Explorer shows one failure notification', async () => {
      // The package row covers all three test classes: they run as one batch, so the single failing test
      // must surface as the failure notification with no per-test success toasts alongside it
      await debugAllClassesViaPackageRow(page, [class1Test, class2Test, failingTest]);
      await verifyNoTestRunInProgress(page);
      await saveScreenshot(page, 'step.debug-test-explorer-all.png');
    });
  }

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
