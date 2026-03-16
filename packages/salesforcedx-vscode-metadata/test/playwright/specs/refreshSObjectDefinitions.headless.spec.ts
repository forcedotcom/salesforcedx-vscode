/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Page } from '@playwright/test';
import { dreamhouseTest as test } from '../fixtures';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  assertWelcomeTabExists,
  closeWelcomeTabs,
  createDreamhouseOrg,
  upsertScratchOrgAuthFieldsToSettings,
  executeCommandWithCommandPalette,
  verifyCommandExists,
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  validateNoCriticalErrors,
  ensureSecondarySideBarHidden,
  QUICK_INPUT_WIDGET,
  QUICK_INPUT_LIST_ROW,
  WORKBENCH
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../package.nls.json';

const CUSTOM_TIMEOUT = 30_000;
const STANDARD_TIMEOUT = 120_000;

test.setTimeout(STANDARD_TIMEOUT + CUSTOM_TIMEOUT + 60_000);

const runRefreshAndVerify = async (
  page: Page,
  quickPickOption: string,
  expectedOutputText: string,
  timeout: number
) => {
  await ensureOutputPanelOpen(page);
  await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
  await clearOutputChannel(page);
  await page.locator(WORKBENCH).click();

  await executeCommandWithCommandPalette(page, packageNls.sobjects_refresh);

  const quickInput = page.locator(QUICK_INPUT_WIDGET);
  await quickInput.waitFor({ state: 'visible', timeout: 10_000 });
  const row = quickInput.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: quickPickOption });
  await row.click();

  await waitForOutputChannelText(page, { expectedText: expectedOutputText, timeout });
};

test('Refresh SObject Definitions: Custom, Standard, All via output channel', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup dreamhouse org', async () => {
    const createResult = await createDreamhouseOrg();
    await waitForVSCodeWorkbench(page);
    await assertWelcomeTabExists(page);
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await upsertScratchOrgAuthFieldsToSettings(page, createResult);

    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, 'Salesforce Metadata', 60_000);
    await waitForOutputChannelText(page, {
      expectedText: 'Salesforce Metadata activation complete',
      timeout: 30_000
    });
    await verifyCommandExists(page, packageNls.sobjects_refresh, 30_000);
  });

  await test.step('Refresh SObject Definitions for Custom SObjects', async () => {
    await runRefreshAndVerify(page, packageNls.sobject_refresh_custom, packageNls.sobject_refresh_output_custom, CUSTOM_TIMEOUT);
  });

  await test.step('Refresh SObject Definitions for Standard SObjects', async () => {
    await runRefreshAndVerify(page, packageNls.sobject_refresh_standard, packageNls.sobject_refresh_output_standard, STANDARD_TIMEOUT);
  });

  await test.step('Refresh SObject Definitions for All SObjects', async () => {
    await runRefreshAndVerify(page, packageNls.sobject_refresh_all, packageNls.sobject_refresh_output_standard, STANDARD_TIMEOUT);
    await waitForOutputChannelText(page, {
      expectedText: packageNls.sobject_refresh_output_custom,
      timeout: 10_000
    });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
