/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Page } from '@playwright/test';
import {
  clickModalDialogButton,
  clearOutputChannel,
  createAndDeployApexTestClass,
  ensureOutputPanelOpen,
  executeCommandWithCommandPalette,
  openFileByName,
  QUICK_INPUT_WIDGET,
  saveScreenshot,
  selectOutputChannel,
  selectQuickInputOptionByTyping,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  setupNonTrackingOrgAndAuth,
  TEST_EXPLORER_PANEL,
  TEST_EXPLORER_TREE_ITEM,
  validateNoCriticalErrors,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../package.nls.json';
import { test } from '../fixtures';
import { TEST_RUN_TIMEOUT } from '../constants';
import { openTestExplorerAndDiscover } from '../helpers/testExplorerHelpers';

/** Run Create Apex Test Suite via command palette: type suite name, select one class, confirm. */
const createApexTestSuiteViaPalette = async (
  page: Page,
  testSuiteName: string,
  testClassName: string
): Promise<void> => {
  await executeCommandWithCommandPalette(page, packageNls.apex_test_suite_create_text);
  const quickInput = page.locator(QUICK_INPUT_WIDGET);
  await quickInput.waitFor({ state: 'visible', timeout: 10_000 });

  // Type suite name and press Enter
  await page.keyboard.type(testSuiteName);
  await page.keyboard.press('Enter');

  // Wait for next prompt (select test classes)
  await quickInput.waitFor({ state: 'visible', timeout: 30_000 });

  // Multi-select picker: toggle the matching row checkbox, then confirm
  await selectQuickInputOptionByTyping(page, testClassName, { optionTimeout: 5000, multiSelect: true });

  // Press Enter to confirm selection
  await page.keyboard.press('Enter');
};

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

    // Confirm the deletion dialog
    await clickModalDialogButton(page, 'Delete Source', 10_000).catch(async () => {
      // Some versions may use a different button label or skip the dialog
      await clickModalDialogButton(page, 'Continue', 5000).catch(() => {});
    });
    await saveScreenshot(page, 'step.delete-confirmed.png');
  });

  await test.step('wait for deletion to complete', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await waitForOutputChannelText(page, {
      expectedText: 'ended',
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
