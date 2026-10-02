/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';

import {
  clearOutputChannel,
  createApexClass,
  createAndDeployApexTestClass,
  deployCurrentSourceToOrg,
  editOpenFile,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  isDesktop,
  openFileByName,
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNonTrackingOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';

import { isContainer, sharedTest as test } from '../fixtures';
import { TEST_RUN_TIMEOUT } from '../constants';
import {
  STALE_FILTER_TAG,
  TEST_EXPLORER_PANEL,
  TEST_EXPLORER_TREE_ITEM,
  clearFilter,
  focusAndTypeInFilter,
  openTestExplorerAndDiscover,
  runAllTestsAndWaitForCompletion
} from '../helpers/testExplorerHelpers';

test.beforeEach(async ({ page }) => {
  if (isContainer) {
    await resetContainerWorkbench(page);
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await clearOutputChannel(page);
  }
});

test('Stale tag is applied on class redeploy and removed by running tests', async ({ page }) => {
  test.setTimeout(TEST_RUN_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Both desktop/web and the container stamp a unique name so this doesn't collide with a prior
  // run's leftover class (container's org/workbench is shared and persistent).
  const testClassName = `StaleTestClass${Date.now()}`;

  // Deploy the currently open editor to the boot org, waiting on the Salesforce Metadata channel.
  // Container-only helper.
  const deployActiveEditor = async (): Promise<void> => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await clearOutputChannel(page);
    await deployCurrentSourceToOrg(page, { waitViaOutputChannel: true });
  };

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

  await test.step('setup Apex test class', async () => {
    if (isContainer) {
      await ensureSecondarySideBarHidden(page);
      await createApexClass(page, testClassName, testClassContent);
      await deployActiveEditor();
      await saveScreenshot(page, 'stale.setup.class-deployed.png');
    } else {
      await setupNonTrackingOrgAndAuth(page);
      await ensureSecondarySideBarHidden(page);
      await createAndDeployApexTestClass(page, testClassName, testClassContent);
    }
  });

  await test.step('discover and run tests to generate result files', async () => {
    await openTestExplorerAndDiscover(page);
    await saveScreenshot(page, 'stale.step.before-run.png');
    await runAllTestsAndWaitForCompletion(page, TEST_RUN_TIMEOUT);
    await saveScreenshot(page, 'stale.step.after-run.png');
  });

  await test.step('redeploy class with trivial change to mark methods stale', async () => {
    // Redeploying an existing ApexClass produces SDR `Changed` (sdrGuards.ts:38-48 →
    // metadataDeployService.ts publishes; apexMetadataChangeWatcher consumes), which
    // routes through ApexTestTreeService.incrementalUpdate → applyIncrementalDiff
    // (apexTestTreeService.ts:1043+) and tags every method on that class with @stale.
    // No window reload required.
    await openFileByName(page, `${testClassName}.cls`);
    await ensureSecondarySideBarHidden(page);
    await editOpenFile(page, 'touched');
    if (isContainer) {
      // The container runs the desktop build with no push-or-deploy-on-save, so deploy explicitly.
      await deployActiveEditor();
    } else if (isDesktop()) {
      // Web: saving a source file in the workspace auto-deploys via push-or-deploy-on-save.
      // Desktop: no auto-deploy on save, so we explicitly invoke "SFDX: Deploy This Source to Org".
      await deployCurrentSourceToOrg(page, { waitViaOutputChannel: true });
    }
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await waitForOutputChannelText(page, { expectedText: testClassName, timeout: 60_000 });
    await saveScreenshot(page, 'stale.step.after-redeploy.png');
  });

  await test.step('verify filtering by @stale shows the redeployed class', async () => {
    // Don't call Test: Refresh Tests — that wipes the tree (testController.refresh
    // → clearTestItems) and the staleTag set by applyIncrementalDiff is lost.
    // applyIncrementalDiff sets staleTag on methods (apexTestTreeService.ts:1066+);
    // the class is rendered as an ancestor of those tagged methods. Polled because
    // the metadata watcher debounces ~1s before applying the diff.
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
    // ApexTestExecutionService.executeTests).
    // Running all tests clears every stale method; once no items carry @stale, filtering by the
    // tag yields zero matches, so no test rows are visible.
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
