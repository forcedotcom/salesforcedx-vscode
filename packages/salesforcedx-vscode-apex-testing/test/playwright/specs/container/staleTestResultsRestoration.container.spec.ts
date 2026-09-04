/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container port of staleTestResultsRestoration.headless.spec.ts. The web twin never
 * runs Apex tests (salesforcedx-vscode-apex has no browser bundle), so no result files or @stale
 * tags exist there. The Code Builder image runs the DESKTOP build in a Node host, so redeploying a
 * class tags its methods @stale via the metadata-change watcher, and running tests clears the tag —
 * this spec proves that incremental-diff path against the boot org (one tracking scratch org authed
 * as default target-org). Stale detection needs a class that is edited then redeployed, so it
 * authors a uniquely-named class (rather than mutating the shared seeded classes on disk).
 */

import { expect } from '@playwright/test';

import {
  clearAllNotifications,
  clearOutputChannel,
  closeAllEditors,
  createApexClass,
  deployCurrentSourceToOrg,
  editOpenFile,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  openFileByName,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';

import { containerTest as test } from '../../fixtures/containerFixtures';
import { TEST_RUN_TIMEOUT } from '../../constants';
import {
  STALE_FILTER_TAG,
  TEST_EXPLORER_PANEL,
  TEST_EXPLORER_TREE_ITEM,
  clearFilter,
  focusAndTypeInFilter,
  openTestExplorerAndDiscover,
  runAllTestsAndWaitForCompletion
} from '../../helpers/testExplorerHelpers';

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
  await ensureOutputPanelOpen(page);
  await selectOutputChannel(page, 'Apex Testing');
  await clearOutputChannel(page);
});

test('Stale tag is applied on class redeploy and removed by running tests', async ({ page }) => {
  test.setTimeout(TEST_RUN_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  const testClassName = `StaleTestClass${Date.now()}`;

  // Deploy the currently open editor to the boot org, waiting on the Salesforce Metadata channel.
  const deployActiveEditor = async (): Promise<void> => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await clearOutputChannel(page);
    await deployCurrentSourceToOrg(page, { waitViaOutputChannel: true });
  };

  await test.step('author + deploy an Apex test class to the boot org', async () => {
    await ensureSecondarySideBarHidden(page);
    const testClassContent = [
      '@isTest',
      `public class ${testClassName} {`,
      '\t@isTest',
      '\tstatic void testMethodOne() {',
      "\t\tSystem.assertEquals(1, 1, 'test one');",
      '\t}',
      '\t@isTest',
      '\tstatic void testMethodTwo() {',
      "\t\tSystem.assertEquals(2, 2, 'test two');",
      '\t}',
      '}'
    ].join('\n');
    await createApexClass(page, testClassName, testClassContent);
    await deployActiveEditor();
    await saveScreenshot(page, 'stale.setup.class-deployed.png');
  });

  await test.step('discover and run tests to generate result files', async () => {
    await openTestExplorerAndDiscover(page);
    await saveScreenshot(page, 'stale.step.before-run.png');
    await runAllTestsAndWaitForCompletion(page, TEST_RUN_TIMEOUT);
    await saveScreenshot(page, 'stale.step.after-run.png');
  });

  await test.step('redeploy class with trivial change to mark methods stale', async () => {
    // Redeploying an existing ApexClass produces SDR `Changed` (sdrGuards.ts → metadataDeployService
    // publishes; apexMetadataChangeWatcher consumes), which routes through
    // ApexTestTreeService.incrementalUpdate → applyIncrementalDiff and tags every method on that
    // class with @stale. No window reload required.
    await openFileByName(page, `${testClassName}.cls`);
    await ensureSecondarySideBarHidden(page);
    await editOpenFile(page, 'touched');
    // The container runs the desktop build with no push-or-deploy-on-save, so deploy explicitly.
    await deployActiveEditor();
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await waitForOutputChannelText(page, { expectedText: testClassName, timeout: 60_000 });
    await saveScreenshot(page, 'stale.step.after-redeploy.png');
  });

  await test.step('verify filtering by @stale shows the redeployed class', async () => {
    // Don't call Test: Refresh Tests — that wipes the tree (testController.refresh
    // → clearTestItems) and the staleTag set by applyIncrementalDiff is lost.
    // applyIncrementalDiff sets staleTag on methods; the class is rendered as an ancestor of those
    // tagged methods. Polled because the metadata watcher debounces ~1s before applying the diff.
    const panel = page.locator(TEST_EXPLORER_PANEL);
    const testClassItem = panel.locator(TEST_EXPLORER_TREE_ITEM).filter({ hasText: new RegExp(testClassName, 'i') });
    await expect(async () => {
      await clearFilter(page);
      await focusAndTypeInFilter(page, STALE_FILTER_TAG);
      await expect(testClassItem.first()).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 60_000 });
    await saveScreenshot(page, 'stale.step.filtered-by-stale.png');
    await clearFilter(page);
  });

  await test.step('run all tests and verify stale tag is removed', async () => {
    // ApexTestTreeService.clearStaleTags removes the staleTag for methods that ran (invoked from
    // ApexTestExecutionService.executeTests). Running all tests clears every stale method; once no
    // items carry @stale, filtering by the tag yields zero matches, so no test rows are visible.
    await runAllTestsAndWaitForCompletion(page, TEST_RUN_TIMEOUT);
    const panel = page.locator(TEST_EXPLORER_PANEL);
    const treeItems = panel.locator(TEST_EXPLORER_TREE_ITEM).filter({ hasText: new RegExp(testClassName, 'i') });
    await expect(async () => {
      await clearFilter(page);
      await focusAndTypeInFilter(page, STALE_FILTER_TAG);
      await expect(treeItems.first()).toBeHidden({ timeout: 2000 });
    }).toPass({ timeout: 30_000 });
    await clearFilter(page);
    await saveScreenshot(page, 'stale.step.after-rerun.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
