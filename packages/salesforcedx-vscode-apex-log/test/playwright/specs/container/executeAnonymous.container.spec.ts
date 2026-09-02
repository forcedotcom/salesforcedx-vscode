/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for anonymous Apex execution (ADR 0022). The web twin
 * (executeAnonymous.headless.spec.ts) proves the flow against a plain Page; this proves anonymous
 * Apex actually executes against the org from inside the Code Builder image, using the container's
 * boot-authed org. The debug marker returned in the Apex Log channel confirms the round-trip
 * (extension → sf → org → log), which web mode cannot cover.
 */

import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  EDITOR_WITH_URI,
  ensureOutputPanelOpen,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  NOTIFICATION_LIST_ITEM,
  saveScreenshot,
  selectOutputChannel,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists,
  waitForOutputChannelText
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

const APEX_LOG_CHANNEL = 'Salesforce Apex Log';
const DEBUG_MARKER = 'cbE2eAnon';

test('Execute Anonymous Apex (Code Builder): runs a debug script against the boot org', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'execAnon.container.01-ready.png');
  });

  await test.step('create an anonymous Apex script', async () => {
    await verifyCommandExists(page, packageNls['apexLog.command.createAnonymousApexScript'], 120_000);
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.createAnonymousApexScript']);
    // The command scaffolds a `.apex` file and opens it in the editor.
    await page.locator(`${EDITOR_WITH_URI}[data-uri$=".apex"]`).first().waitFor({ state: 'visible', timeout: 30_000 });
  });

  await test.step('replace the script body with a debug statement', async () => {
    // Select the whole template body, then type over it so the buffer is exactly our statement.
    await page.keyboard.press('Control+A');
    await page.keyboard.type(`System.debug('${DEBUG_MARKER}');`);
    await saveScreenshot(page, 'execAnon.container.02-typed.png');
  });

  await test.step('execute the open editor and assert success', async () => {
    await verifyCommandExists(page, packageNls['apexLog.command.executeDocument'], 30_000);
    await executeCommandWithCommandPalette(page, packageNls['apexLog.command.executeDocument']);

    const successNotification = page.locator(NOTIFICATION_LIST_ITEM).filter({ hasText: /executed successfully/i });
    await expect(successNotification.first()).toBeVisible({ timeout: 120_000 });
    await saveScreenshot(page, 'execAnon.container.03-success.png');
  });

  await test.step('assert the debug marker landed in the Apex Log channel', async () => {
    await ensureOutputPanelOpen(page);
    await selectOutputChannel(page, APEX_LOG_CHANNEL);
    // USER_DEBUG proves the org actually ran the anonymous block and returned its log.
    await waitForOutputChannelText(page, { expectedText: 'USER_DEBUG', timeout: 60_000 });
    await waitForOutputChannelText(page, { expectedText: DEBUG_MARKER, timeout: 10_000 });
    await saveScreenshot(page, 'execAnon.container.04-log.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
