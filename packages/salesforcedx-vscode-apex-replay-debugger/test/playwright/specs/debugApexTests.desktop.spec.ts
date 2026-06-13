/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect, type Page } from '@playwright/test';
import {
  clickCodeLens,
  createApexClass,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  NOTIFICATION_LIST_ITEM,
  openFileByName,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupMinimalOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForOutputChannelText,
  WORKBENCH
} from '@salesforce/playwright-vscode-ext';

import apexTestingNls from 'salesforcedx-vscode-apex-testing/package.nls.json';
import metadataNls from 'salesforcedx-vscode-metadata/package.nls.json';
import { test } from '../fixtures';

/** Continue debug session (dismiss hover, Escape, then F5). Repeats until session ends. */
const continueDebugSession = async (page: Page, maxContinues = 2): Promise<void> => {
  const toolbar = page.locator('.debug-toolbar');
  for (let i = 0; i < maxContinues; i++) {
    await toolbar.waitFor({ state: 'visible', timeout: 15_000 });
    // Click editor area to dismiss search-bar hover that can cover debug toolbar and block F5
    await page.locator(`${WORKBENCH} .editor-instance .view-lines`).first().click({ force: true });
    await page.keyboard.press('Escape');
    await page.keyboard.press('F5');
    const sessionEnded = await expect(toolbar)
      .not.toBeVisible({ timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    if (sessionEnded) break;
  }
  await expect(toolbar).not.toBeVisible({ timeout: 45_000 });
};

/**
 * Clicks a Test Explorer tree row's "Debug Test" action button using the retry/force-click pattern.
 * Clicking a tree row re-renders the tree (selection highlight + action buttons), invalidating element
 * refs — mirrors the WDIO StaleElementReferenceError handling in the source spec.
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

const class1Content = [
  'public with sharing class ExampleApexClass1 {',
  '  public static void SayHello(string name){',
  "    System.debug('Hello, ' + name + '!');",
  '  }',
  '}'
].join('\n');

const class1TestContent = [
  '@IsTest',
  'public class ExampleApexClass1Test {',
  '  @IsTest',
  '  static void validateSayHello() {',
  "    System.debug('Starting validate');",
  "    ExampleApexClass1.SayHello('Cody');",
  '',
  "    System.assertEquals(1, 1, 'all good');",
  '  }',
  '}'
].join('\n');

const class2Content = [
  'public with sharing class ExampleApexClass2 {',
  '  public static void SayHello(string name){',
  "    System.debug('Hello, ' + name + '!');",
  '  }',
  '}'
].join('\n');

// Distinct method name from ExampleApexClass1Test so the Test Explorer treeitem label is unique
// (both classes nest under the same Namespace/Package parents; a shared method name would match
// two virtualized treeitem rows and trip Playwright strict mode).
const class2TestContent = [
  '@IsTest',
  'public class ExampleApexClass2Test {',
  '  @IsTest',
  '  static void validateSayHelloTwo() {',
  "    System.debug('Starting validate');",
  "    ExampleApexClass2.SayHello('Cody');",
  '',
  "    System.assertEquals(1, 1, 'all good');",
  '  }',
  '}'
].join('\n');

test('Debug Apex Tests: codelens and Test Explorer entry points', async ({ page }) => {
  test.setTimeout(600_000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup minimal org with two Apex classes and their tests', async () => {
    await setupMinimalOrgAndAuth(page);
    await ensureSecondarySideBarHidden(page);
    await createApexClass(page, 'ExampleApexClass1', class1Content);
    await createApexClass(page, 'ExampleApexClass1Test', class1TestContent);
    await createApexClass(page, 'ExampleApexClass2', class2Content);
    await createApexClass(page, 'ExampleApexClass2Test', class2TestContent);
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await executeCommandWithCommandPalette(page, metadataNls.project_deploy_start_ignore_conflicts_default_org_text);
    await waitForOutputChannelText(page, { expectedText: 'Starting metadata deployment', timeout: 30_000 });
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: 120_000 });
    await saveScreenshot(page, 'setup.classes-created.png');
  });

  await test.step('wait for CodeLens in test class', async () => {
    // Apex LS must finish indexing before CodeLens appear; CI is slower
    const indexingComplete = page.getByRole('button', { name: /Indexing complete/ });
    await expect(indexingComplete).toBeVisible({ timeout: 120_000 });
    await openFileByName(page, 'ExampleApexClass1Test.cls');
    const codelens = page.locator('.codelens-decoration a').filter({ hasText: /Run Test|Debug Test/ });
    await expect(codelens.first()).toBeVisible({ timeout: 90_000 });
    await saveScreenshot(page, 'step.codelens-visible.png');
  });

  await test.step('Debug All Tests via class-level CodeLens', async () => {
    await openFileByName(page, 'ExampleApexClass1Test.cls');
    await clickCodeLens(page, 'Debug All Tests', { timeout: 180_000 });
    await waitForSuccessNotification(page);
    await continueDebugSession(page);
    await saveScreenshot(page, 'step.debug-all-tests.png');
  });

  await test.step('Debug Test via method-level CodeLens', async () => {
    await openFileByName(page, 'ExampleApexClass2Test.cls');
    await clickCodeLens(page, 'Debug Test', { timeout: 180_000 });
    await waitForSuccessNotification(page);
    await continueDebugSession(page);
    await saveScreenshot(page, 'step.debug-single-test.png');
  });

  await test.step('Debug class via Test Explorer', async () => {
    await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
    // Refresh rebuilds the tree async; wait for rebuild then expand parents so class rows render
    await refreshTestsAndWaitForRebuild(page);
    await expandNamespaceAndPackage(page);
    await debugTestFromTreeItem(page, /ExampleApexClass1Test/i);
    await waitForSuccessNotification(page);
    await continueDebugSession(page);
    await saveScreenshot(page, 'step.debug-test-explorer-class.png');
  });

  await test.step('Debug method via Test Explorer', async () => {
    await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
    await expandNamespaceAndPackage(page);
    // Expand the class node to reveal its method, then debug the method row
    await expandTreeRow(page, 'ExampleApexClass2Test');
    const methodItem = page.getByRole('treeitem', { name: /validateSayHelloTwo/i });
    await methodItem.waitFor({ state: 'visible', timeout: 30_000 });
    await debugTestFromTreeItem(page, /validateSayHelloTwo/i);
    await waitForSuccessNotification(page);
    await continueDebugSession(page);
    await saveScreenshot(page, 'step.debug-test-explorer-method.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
