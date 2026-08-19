/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  clearOutputChannel,
  createAndDeployApexTestClass,
  ensureOutputPanelOpen,
  executeCommandWithCommandPalette,
  NOTIFICATION_LIST_ITEM,
  openFileFromExplorerTree,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  setupMinimalOrgAndAuth,
  TEST_EXPLORER_PANEL,
  TEST_EXPLORER_TREE_ITEM,
  upsertSettings,
  validateNoCriticalErrors,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';

import { trackingTest as test } from '../fixtures';
import { TEST_RUN_TIMEOUT } from '../constants';
import { expandTreeRow, openTestExplorerAndDiscover } from '../helpers/testExplorerHelpers';
import { createApexTestSuiteViaPalette, createLocalApexTestSuiteFile } from '../helpers/apexTestSuiteHelpers';

test('Apex Test Suite: delete suite and verify it disappears from Testing sidebar without refresh', async ({
  page
}) => {
  test.setTimeout(TEST_RUN_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let testClassName: string;
  let testSuiteName: string;

  await test.step('setup tracking org with an Apex test class', async () => {
    await setupMinimalOrgAndAuth(page);

    testClassName = `SuiteDelTestClass${Date.now()}`;
    const testClassContent = [
      '@isTest',
      `public class ${testClassName} {`,
      '\t@isTest',
      '\tstatic void testMethod1() {',
      "\t\tSystem.assertEquals(1, 1, 'Test should pass');",
      '\t}',
      '}'
    ].join('\n');
    await createAndDeployApexTestClass(page, testClassName, testClassContent);
    await saveScreenshot(page, 'setup.test-class-created.png');
  });

  await test.step('create Apex Test Suite', async () => {
    testSuiteName = `DelSuite${Date.now()}`;
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await clearOutputChannel(page);
    await createApexTestSuiteViaPalette(page, testSuiteName, testClassName);
    await saveScreenshot(page, 'step.create-suite.done.png');
  });

  await test.step('verify suite creation', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Apex Testing');
    await waitForOutputChannelText(page, {
      expectedText: 'Ended SFDX: Create Apex Test Suite',
      timeout: 60_000
    });
    await saveScreenshot(page, 'step.verify-creation.png');
  });

  await test.step('verify suite appears in Testing sidebar', async () => {
    const panel = await openTestExplorerAndDiscover(page);

    // The "Apex Test Suites" parent item should be visible
    const suiteParent = panel.locator(TEST_EXPLORER_TREE_ITEM).filter({ hasText: 'Apex Test Suites' });
    await expect(suiteParent).toBeVisible({ timeout: 30_000 });

    // Expand the "Apex Test Suites" parent so child suite items become visible in the tree
    await expandTreeRow(panel, 'Apex Test Suites');

    // The specific suite name should be visible as a baseline before deletion
    const suiteItem = panel.locator(TEST_EXPLORER_TREE_ITEM).filter({ hasText: testSuiteName });
    await expect(suiteItem).toBeVisible({ timeout: 15_000 });
    await saveScreenshot(page, 'step.suite-visible-in-sidebar.png');
  });

  await test.step('create the test suite metadata file locally', async () => {
    await upsertSettings(page, { 'salesforcedx-vscode-core.push-or-deploy-on-save.enabled': 'false' });
    await createLocalApexTestSuiteFile(page, testSuiteName, testClassName);
    await saveScreenshot(page, 'step.local-suite-file-created.png');
  });

  await test.step('open the .testSuite-meta.xml file and delete from project and org', async () => {
    // Open the test suite file via the Explorer tree (Quick Open can't find newly-created files on web).
    // force-app/main/default is already expanded by default; just expand testSuites to reach the file.
    await openFileFromExplorerTree(page, `${testSuiteName}.testSuite-meta.xml`, ['testSuites']);
    await saveScreenshot(page, 'step.suite-file-opened.png');

    // Run "SFDX: Delete from Project and Org" via command palette
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, 'SFDX: Delete from Project and Org');
    await saveScreenshot(page, 'step.delete-command-executed.png');

    // The delete confirmation surfaces as a notification toast with a "Delete Source" button
    const deleteConfirmation = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /Deleting source files deletes the files from your computer/ })
      .first();
    await expect(deleteConfirmation).toBeVisible({ timeout: 15_000 });
    await deleteConfirmation.getByRole('button', { name: 'Delete Source' }).click();
    await saveScreenshot(page, 'step.delete-confirmed.png');
  });

  await test.step('wait for deletion to complete', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await waitForOutputChannelText(page, {
      expectedText: 'Deleted Source',
      timeout: 120_000
    });
    await saveScreenshot(page, 'step.delete-completed.png');
  });

  await test.step('verify suite disappears from Testing sidebar without manual refresh', async () => {
    // Re-focus the Test Explorer — the delete flow leaves focus on the Output panel.
    await executeCommandWithCommandPalette(page, 'Testing: Focus on Test Explorer View');
    const panel = page.locator(TEST_EXPLORER_PANEL);
    await panel.waitFor({ state: 'visible', timeout: 10_000 });

    // The deleted suite should disappear without manual refresh. Other suites can legitimately
    // remain in the shared org, including suites left by a previous failed test attempt.
    const suiteItem = panel.locator(TEST_EXPLORER_TREE_ITEM).filter({ hasText: testSuiteName });
    await expect(suiteItem).toBeHidden({ timeout: 60_000 });
    await saveScreenshot(page, 'step.suite-gone-from-sidebar.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
