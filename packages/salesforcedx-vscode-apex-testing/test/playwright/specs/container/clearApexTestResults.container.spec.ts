/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container port of clearApexTestResults.headless.spec.ts. The web twin never runs Apex
 * tests because salesforcedx-vscode-apex has no browser bundle, so there are no result files to
 * clear. The Code Builder image runs the DESKTOP build in a Node host, so running tests, clearing
 * results, and confirming the stale filter option is gone all work end-to-end against the boot org
 * (one tracking scratch org authed as default target-org). It reuses the seeded PagedResultTest
 * class instead of authoring a new one.
 */

import { expect } from '@playwright/test';

import {
  clearAllNotifications,
  clearOutputChannel,
  closeAllEditors,
  deployCurrentSourceToOrg,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  openFileByName,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';
import { TEST_RUN_TIMEOUT } from '../../constants';
import {
  STALE_AUTOCOMPLETE_OPTION,
  TEST_EXPLORER_PANEL,
  clearFilter,
  focusAndTypeInFilter,
  openTestExplorerAndDiscover,
  refreshTestsAndWaitForRebuild,
  runAllTestsAndWaitForCompletion
} from '../../helpers/testExplorerHelpers';

test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
  await ensureOutputPanelOpen(page);
  await selectOutputChannel(page, 'Apex Testing');
  await clearOutputChannel(page);
});

test('Clear Apex Test Results removes result files', async ({ page }) => {
  test.setTimeout(TEST_RUN_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  // Deploy an open editor's source to the boot org, waiting on the Salesforce Metadata channel.
  const deployOpenFile = async (fileName: string): Promise<void> => {
    await openFileByName(page, fileName);
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata');
    await clearOutputChannel(page);
    await deployCurrentSourceToOrg(page, { waitViaOutputChannel: true });
  };

  await test.step('deploy seeded Apex class to the boot org', async () => {
    await ensureSecondarySideBarHidden(page);
    await deployOpenFile('PagedResult.cls');
    await deployOpenFile('PagedResultTest.cls');
    await saveScreenshot(page, 'setup.test-class-deployed.png');
  });

  await test.step('discover and run tests', async () => {
    await openTestExplorerAndDiscover(page);
    await runAllTestsAndWaitForCompletion(page, TEST_RUN_TIMEOUT);
    await saveScreenshot(page, 'clear.step.after-run.png');
  });

  await test.step('execute clear apex test results command', async () => {
    await executeCommandWithCommandPalette(page, packageNls.apex_test_clear_results_text);
    await saveScreenshot(page, 'clear.step.after-clear.png');
  });

  await test.step('refresh and verify results are not restored', async () => {
    await refreshTestsAndWaitForRebuild(page, page.locator(TEST_EXPLORER_PANEL));
    await saveScreenshot(page, 'clear.step.after-refresh.png');
    await focusAndTypeInFilter(page, '@');
    const staleOption = page.getByText(STALE_AUTOCOMPLETE_OPTION);
    await expect(staleOption).not.toBeVisible({ timeout: 5000 });
    await clearFilter(page);
    await saveScreenshot(page, 'clear.step.no-stale-after-clear.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
