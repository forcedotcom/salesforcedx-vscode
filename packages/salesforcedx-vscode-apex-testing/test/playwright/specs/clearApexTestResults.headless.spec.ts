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
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  resetContainerWorkbench,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNonTrackingOrgAndAuth,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';

import packageNls from '../../../package.nls.json';
import { isContainer, sharedTest as test } from '../fixtures';
import { TEST_RUN_TIMEOUT } from '../constants';
import {
  STALE_AUTOCOMPLETE_OPTION,
  TEST_EXPLORER_PANEL,
  clearFilter,
  focusAndTypeInFilter,
  openTestExplorerAndDiscover,
  refreshTestsAndWaitForRebuild,
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

test('Clear Apex Test Results removes result files', async ({ page }) => {
  test.setTimeout(TEST_RUN_TIMEOUT);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup Apex test class', async () => {
    // The container uses its boot org, already authed at startup.
    if (!isContainer) {
      await setupNonTrackingOrgAndAuth(page);
    }
    await ensureSecondarySideBarHidden(page);
    const testClassName = `ClearTestClass${Date.now()}`;
    const testClassContent = [
      '@isTest',
      `public class ${testClassName} {`,
      '\t@isTest',
      '\tstatic void testClearMethod() {',
      "\t\tSystem.assertEquals(1, 1, 'clear test');",
      '\t}',
      '}'
    ].join('\n');
    await createAndDeployApexTestClass(page, testClassName, testClassContent);
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
