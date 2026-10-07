/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect, type Page } from '@playwright/test';
import {
  clickCodeLens,
  continueDebugSession,
  createApexClass,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
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
  waitForOutputChannelText
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
  // left by a prior run.
  const uid = Date.now().toString(36);
  const class1 = isContainer ? `ExampleApexClass1_${uid}` : 'ExampleApexClass1';
  const class1Test = isContainer ? `ExampleApexClass1_${uid}Test` : 'ExampleApexClass1Test';
  const class2 = isContainer ? `ExampleApexClass2_${uid}` : 'ExampleApexClass2';
  const class2Test = isContainer ? `ExampleApexClass2_${uid}Test` : 'ExampleApexClass2Test';

  const class1Content = [
    `public with sharing class ${class1} {`,
    '  public static void SayHello(string name){',
    "    System.debug('Hello, ' + name + '!');",
    '  }',
    '}'
  ].join('\n');

  // Annotations kept INLINE with their declarations: once the Apex LS is warm, a bare `@IsTest` line
  // typed into the code-server editor can have its trailing newline swallowed by a completion-accept,
  // merging it into the next line and producing invalid Apex.
  const class1TestContent = isContainer
    ? [
        `@IsTest public class ${class1Test} {`,
        '  @IsTest static void validateSayHello() {',
        "    System.debug('Starting validate');",
        `    ${class1}.SayHello('Cody');`,
        "    System.assertEquals(1, 1, 'all good');",
        '  }',
        '}'
      ].join('\n')
    : [
        '@IsTest',
        `public class ${class1Test} {`,
        '  @IsTest',
        '  static void validateSayHello() {',
        "    System.debug('Starting validate');",
        `    ${class1}.SayHello('Cody');`,
        '',
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
  const class2TestContent = isContainer
    ? [
        `@IsTest public class ${class2Test} {`,
        '  @IsTest static void validateSayHelloTwo() {',
        "    System.debug('Starting validate');",
        `    ${class2}.SayHello('Cody');`,
        "    System.assertEquals(1, 1, 'all good');",
        '  }',
        '}'
      ].join('\n')
    : [
        '@IsTest',
        `public class ${class2Test} {`,
        '  @IsTest',
        '  static void validateSayHelloTwo() {',
        "    System.debug('Starting validate');",
        `    ${class2}.SayHello('Cody');`,
        '',
        "    System.assertEquals(1, 1, 'all good');",
        '  }',
        '}'
      ].join('\n');

  await test.step('setup with two Apex classes and their tests', async () => {
    if (!isContainer) {
      await setupMinimalOrgAndAuth(page);
    }
    await ensureSecondarySideBarHidden(page);
    await createApexClass(page, class1, class1Content);
    await createApexClass(page, class1Test, class1TestContent);
    await createApexClass(page, class2, class2Content);
    await createApexClass(page, class2Test, class2TestContent);
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await executeCommandWithCommandPalette(page, metadataNls.project_deploy_start_ignore_conflicts_default_org_text);
    await waitForOutputChannelText(page, { expectedText: 'Starting metadata deployment', timeout: 90_000 });
    await waitForOutputChannelText(page, { expectedText: 'Deployed Source', timeout: 120_000 });
    await saveScreenshot(page, 'setup.classes-created.png');
  });

  await test.step('wait for CodeLens in test class', async () => {
    const openTestClassContainer = async (): Promise<void> => {
      // The desktop "Indexing complete" status-bar button never renders in the code-server image, so
      // gate on the real indexing signal instead: the test class' CodeLens only appears once the LS
      // has indexed it.
      await openFileByName(page, `${class1Test}.cls`);
    };
    const openTestClassDesktop = async (): Promise<void> => {
      // Apex LS must finish indexing before CodeLens appear; CI is slower
      const indexingComplete = page.getByRole('button', { name: /Indexing complete/ });
      await expect(indexingComplete).toBeVisible({ timeout: 120_000 });
      await openFileByName(page, `${class1Test}.cls`);
    };
    await (isContainer ? openTestClassContainer : openTestClassDesktop)();
    const codelens = page.locator('.codelens-decoration a').filter({ hasText: /Run Test|Debug Test/ });
    await expect(codelens.first()).toBeVisible({ timeout: isContainer ? 120_000 : 90_000 });
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

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
