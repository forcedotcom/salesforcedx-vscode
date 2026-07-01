/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  clickModalDialogButton,
  clearOutputChannel,
  createAndDeployApexTestClass,
  ensureOutputPanelOpen,
  executeCommandWithCommandPalette,
  openFileByName,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  setupNonTrackingOrgAndAuth,
  TEST_EXPLORER_PANEL,
  TEST_EXPLORER_TREE_ITEM,
  validateNoCriticalErrors,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';

import { test } from '../fixtures';
import { TEST_RUN_TIMEOUT } from '../constants';
import { openTestExplorerAndDiscover } from '../helpers/testExplorerHelpers';
import { createApexTestSuiteViaPalette } from '../helpers/apexTestSuiteHelpers';

test('Apex Test Suite: delete suite and verify it disappears from Testing sidebar without refresh', async ({
  page
}) => {
  test.setTimeout(TEST_RUN_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  let testClassName: string;
  let testSuiteName: string;

  await test.step('setup non-tracking org with an Apex test class', async () => {
    await setupNonTrackingOrgAndAuth(page);

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

    // The specific suite name should be visible as a baseline before deletion
    const suiteItem = panel.locator(TEST_EXPLORER_TREE_ITEM).filter({ hasText: testSuiteName });
    await expect(suiteItem).toBeVisible({ timeout: 15_000 });
    await saveScreenshot(page, 'step.suite-visible-in-sidebar.png');
  });

  await test.step('open the .testSuite-meta.xml file and delete from project and org', async () => {
    // Open the test suite file via Go to File
    await openFileByName(page, `${testSuiteName}.testSuite-meta.xml`);
    await saveScreenshot(page, 'step.suite-file-opened.png');

    // Run "SFDX: Delete from Project and Org" via command palette
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await clearOutputChannel(page);
    await executeCommandWithCommandPalette(page, 'SFDX: Delete from Project and Org');
    await saveScreenshot(page, 'step.delete-command-executed.png');

    // Confirm the deletion dialog — try primary label, fall back to alternate label
    try {
      await clickModalDialogButton(page, 'Delete Source', 10_000);
    } catch {
      // Some versions use a different button label; try the alternate
      try {
        await clickModalDialogButton(page, 'Continue', 5000);
      } catch (fallbackError) {
        console.warn('Neither "Delete Source" nor "Continue" dialog button found:', fallbackError);
      }
    }
    await saveScreenshot(page, 'step.delete-confirmed.png');
  });

  await test.step('wait for deletion to complete', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await waitForOutputChannelText(page, {
      expectedText: 'Ended SFDX: Delete from Project and Org',
      timeout: 120_000
    });
    await saveScreenshot(page, 'step.delete-completed.png');
  });

  await test.step('verify suite disappears from Testing sidebar without manual refresh', async () => {
    const panel = page.locator(TEST_EXPLORER_PANEL);
    await panel.waitFor({ state: 'visible', timeout: 10_000 });

    // The suite should disappear from the tree without manual refresh.
    // Wait for the "Apex Test Suites" parent to become hidden (tree rebuild removes it
    // because populateSuiteItems returns no suites from the org).
    const suiteParent = panel.locator(TEST_EXPLORER_TREE_ITEM).filter({ hasText: 'Apex Test Suites' });
    await expect(suiteParent).toBeHidden({ timeout: 60_000 });
    await saveScreenshot(page, 'step.suite-gone-from-sidebar.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
