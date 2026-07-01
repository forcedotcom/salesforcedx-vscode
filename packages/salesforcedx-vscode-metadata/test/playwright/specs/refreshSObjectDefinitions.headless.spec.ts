/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { type Page, expect } from '@playwright/test';
import { dreamhouseTest as test } from '../fixtures';
import { dreamhouseDesktopTest } from '../fixtures/desktopFixtures';
import {
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  waitForVSCodeWorkbench,
  closeWelcomeTabs,
  createDreamhouseOrg,
  upsertScratchOrgAuthFieldsToSettings,
  executeCommandWithCommandPalette,
  verifyCommandExists,
  ensureOutputPanelOpen,
  selectOutputChannel,
  clearOutputChannel,
  waitForOutputChannelText,
  outputChannelContains,
  validateNoCriticalErrors,
  ensureSecondarySideBarHidden,
  activeQuickInputWidget,
  isDesktop,
  QUICK_INPUT_LIST_ROW,
  WORKBENCH
} from '@salesforce/playwright-vscode-ext';
import * as fs from 'node:fs';
import * as path from 'node:path';
import packageNls from '../../../package.nls.json';

const GENERIC_ERROR = 'An error has occurred';

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

  const quickInput = activeQuickInputWidget(page);
  await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
  const row = quickInput.locator(QUICK_INPUT_LIST_ROW).filter({ hasText: quickPickOption });
  await row.click({ force: true });

  await waitForOutputChannelText(page, { expectedText: expectedOutputText, timeout });
};

test('Refresh SObject Definitions: Custom, Standard, All via output channel', async ({ page }) => {
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('setup dreamhouse org', async () => {
    const createResult = await createDreamhouseOrg();
    await waitForVSCodeWorkbench(page);
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
    await runRefreshAndVerify(
      page,
      packageNls.sobject_refresh_custom,
      packageNls.sobject_refresh_output_custom,
      CUSTOM_TIMEOUT
    );
  });

  await test.step('Refresh SObject Definitions for Standard SObjects', async () => {
    await runRefreshAndVerify(
      page,
      packageNls.sobject_refresh_standard,
      packageNls.sobject_refresh_output_standard,
      STANDARD_TIMEOUT
    );
  });

  await test.step('Refresh SObject Definitions for All SObjects', async () => {
    await runRefreshAndVerify(
      page,
      packageNls.sobject_refresh_all,
      packageNls.sobject_refresh_output_standard,
      STANDARD_TIMEOUT
    );
    await waitForOutputChannelText(page, {
      expectedText: packageNls.sobject_refresh_output_custom,
      timeout: 10_000
    });
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});

// Desktop-only: a real filesystem is needed to force a write (EACCES) failure by chmod-ing the output dir.
// Use the desktop fixture directly so `workspaceDir` is typed; skip when not on desktop.
const failureTest = isDesktop() ? dreamhouseDesktopTest : dreamhouseDesktopTest.skip.bind(dreamhouseDesktopTest);
failureTest(
  'Refresh SObject Definitions: write failure surfaces real error, not "An error has occurred"',
  async ({ page, workspaceDir }) => {
    const consoleErrors = setupConsoleMonitoring(page);
    const networkErrors = setupNetworkMonitoring(page);

    // .sfdx/tools is the parent of the sobjects output dir; making it read-only makes createDirectory/writeFile fail.
    const toolsDir = path.join(workspaceDir, '.sfdx', 'tools');

    await test.step('setup dreamhouse org', async () => {
      const createResult = await createDreamhouseOrg();
      await waitForVSCodeWorkbench(page);
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

    try {
      await test.step('force the output dir read-only, then refresh', async () => {
        fs.mkdirSync(toolsDir, { recursive: true });
        fs.chmodSync(toolsDir, 0o555);

        await clearOutputChannel(page);
        await page.locator(WORKBENCH).click();

        await executeCommandWithCommandPalette(page, packageNls.sobjects_refresh);
        const quickInput = activeQuickInputWidget(page);
        await quickInput.waitFor({ state: 'attached', timeout: 10_000 });
        await quickInput
          .locator(QUICK_INPUT_LIST_ROW)
          .filter({ hasText: packageNls.sobject_refresh_custom })
          .click({ force: true });
      });

      await test.step('real permission error is shown, generic string is not', async () => {
        // EACCES/permission text is the real underlying failure the fix surfaces.
        await waitForOutputChannelText(page, { expectedText: 'EACCES', timeout: 60_000 }).catch(async () => {
          await waitForOutputChannelText(page, { expectedText: 'permission denied', timeout: 5000 });
        });
        expect(await outputChannelContains(page, GENERIC_ERROR)).toBe(false);
      });
    } finally {
      fs.chmodSync(toolsDir, 0o755);
    }

    await validateNoCriticalErrors(test, consoleErrors, networkErrors);
  }
);
