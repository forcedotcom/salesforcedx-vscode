/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container twin of debugApexTests.desktop (ADR 0022, W-23898526). Debugs Apex tests through both
 * entry points against the container's boot (default target) org — the quickLaunch debugTest path
 * manages its own trace flag, so no manual trace-flag setup is needed:
 *   - "Debug All Tests" / "Debug Test" CodeLens
 *   - "Debug Test" from the Test Explorer tree (class + method rows)
 * Waits for Apex LS indexing/CodeLens like the apexReplayDebugger precedent. Hardened for the shared,
 * persistent workbench: unique per-run class names, a beforeEach reset, and an afterEach that stops
 * any leaked session.
 */

import { expect, type Page } from '@playwright/test';
import {
  activateEditorTab,
  clearAllNotifications,
  clickCodeLens,
  closeAllEditors,
  closeWelcomeTabs,
  continueDebugSession,
  createApexClass,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  NOTIFICATION_LIST_ITEM,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  stopDebugSession,
  validateNoCriticalErrors,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';

import apexTestingNls from 'salesforcedx-vscode-apex-testing/package.nls.json';
import metadataNls from 'salesforcedx-vscode-metadata/package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

/**
 * Clicks a Test Explorer tree row's "Debug Test" action button using the retry/force-click pattern.
 * Clicking a tree row re-renders the tree (selection highlight + action buttons), invalidating element
 * refs — retry/force-click to tolerate the stale refs.
 */
const debugTestFromTreeItem = async (page: Page, name: RegExp): Promise<void> => {
  const item = page.getByRole('treeitem', { name });
  await item.waitFor({ state: 'visible', timeout: 30_000 });
  await expect(async () => {
    await item.click({ force: true });
    await item.hover({ force: true });
    const debugButton = item.getByRole('button', { name: /^Debug Test/ });
    await debugButton.waitFor({ state: 'visible', timeout: 3000 });
    await debugButton.click({ force: true });
  }).toPass({ timeout: 30_000 });
};

// Test Explorer builds a Namespace → Package → Class → Method hierarchy; unpackaged local classes
// nest under these two labels. Collapsed parents virtualize their children, so class/method rows are
// not in the DOM until both parents are expanded.
const LOCAL_NAMESPACE_LABEL = '(Local Namespace)';
const UNPACKAGED_METADATA_LABEL = '(Unpackaged Metadata)';

/** Expand a Test Explorer tree row via its twistie if collapsed; 400ms settle matches apex-testing helper. */
const expandTreeRow = async (page: Page, rowLabel: string): Promise<void> => {
  const row = page.locator('[role="treeitem"]').filter({ hasText: rowLabel }).first();
  await row.waitFor({ state: 'visible', timeout: 15_000 });
  const twistie = row.locator('.monaco-tl-twistie');
  const collapsed = await twistie.evaluate(el => el.classList.contains('collapsed')).catch(() => false);
  if (!collapsed) return;
  await twistie.click({ force: true });
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
 * tree after the command returns (mirrors apex-testing refreshTestsAndWaitForRebuild).
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

test.beforeEach(async ({ page }) => {
  await closeWelcomeTabs(page);
  await ensureSecondarySideBarHidden(page);
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test.afterEach(async ({ page }) => {
  await stopDebugSession(page);
});

test('Debug Apex Tests (Code Builder): CodeLens and Test Explorer entry points', async ({ page }) => {
  test.setTimeout(600_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

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

  // Annotations are kept INLINE with their declarations (not on their own line). Once the Apex LS is
  // warm, a bare `@IsTest` line typed into the code-server editor triggers a completion popup whose
  // Enter (the next newline) gets swallowed as an accept, merging the annotation into the following
  // declaration and producing invalid Apex ("must be declared as IsTest" / "must have public
  // visibility"). Inlining removes the bare-annotation-then-Enter that causes the merge.
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

  // Distinct method name from class1Test so the Test Explorer treeitem label is unique. Annotations
  // kept inline (see class1TestContent) to avoid the warm-LS suggestion-accept newline merge.
  const class2TestContent = [
    `@IsTest public class ${class2Test} {`,
    '  @IsTest static void validateSayHelloTwo() {',
    "    System.debug('Starting validate');",
    `    ${class2}.SayHello('Cody');`,
    "    System.assertEquals(1, 1, 'all good');",
    '  }',
    '}'
  ].join('\n');

  await test.step('deploy two Apex classes and their tests to the boot org', async () => {
    await ensureSecondarySideBarHidden(page);
    await createApexClass(page, class1, class1Content);
    await createApexClass(page, class1Test, class1TestContent);
    await createApexClass(page, class2, class2Content);
    await createApexClass(page, class2Test, class2TestContent);
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

  await test.step('wait for CodeLens in the test class', async () => {
    // The desktop "Indexing complete" status-bar button never renders in the code-server image, so
    // gate on the real indexing signal: the test class' CodeLens (Run/Debug Test) only appears once
    // the Apex LS has indexed it.
    await activateEditorTab(page, `${class1Test}.cls`);
    const codelens = page.locator('.codelens-decoration a').filter({ hasText: /Run Test|Debug Test/ });
    await expect(codelens.first()).toBeVisible({ timeout: 120_000 });
    await saveScreenshot(page, 'step.codelens-visible.png');
  });

  await test.step('Debug All Tests via class-level CodeLens', async () => {
    await activateEditorTab(page, `${class1Test}.cls`);
    await clickCodeLens(page, 'Debug All Tests', { timeout: 180_000 });
    await waitForSuccessNotification(page);
    await continueDebugSession(page);
    await saveScreenshot(page, 'step.debug-all-tests.png');
  });

  await test.step('Debug Test via method-level CodeLens', async () => {
    await activateEditorTab(page, `${class2Test}.cls`);
    await clickCodeLens(page, 'Debug Test', { timeout: 180_000 });
    await waitForSuccessNotification(page);
    await continueDebugSession(page);
    await saveScreenshot(page, 'step.debug-single-test.png');
  });

  await test.step('Debug class via Test Explorer', async () => {
    await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
    await refreshTestsAndWaitForRebuild(page);
    await expandNamespaceAndPackage(page);
    await debugTestFromTreeItem(page, new RegExp(class1Test, 'i'));
    await waitForSuccessNotification(page);
    await continueDebugSession(page);
    await saveScreenshot(page, 'step.debug-test-explorer-class.png');
  });

  await test.step('Debug method via Test Explorer', async () => {
    await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
    await expandNamespaceAndPackage(page);
    await expandTreeRow(page, class2Test);
    const methodItem = page.getByRole('treeitem', { name: /validateSayHelloTwo/i });
    await methodItem.waitFor({ state: 'visible', timeout: 30_000 });
    await debugTestFromTreeItem(page, /validateSayHelloTwo/i);
    await waitForSuccessNotification(page);
    await continueDebugSession(page);
    await saveScreenshot(page, 'step.debug-test-explorer-method.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
