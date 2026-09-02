/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for Apex test discovery in the native Test Explorer (ADR 0022). The web twins
 * (testExplorer.headless.spec.ts, runApexTests*.headless.spec.ts) are desktop-only because VS Code
 * Web has no Apex language-server browser bundle, so tests never surface there. The Code Builder
 * image runs the DESKTOP build in a Node host, so the Apex LSP IS present — this spec proves that
 * container-unique path: the LSP indexes the seeded @isTest class and contributes it to the VS Code
 * Test Controller. Discovery is local (no org run, no deploy), so it is a fast, deterministic signal
 * of the exact integration web mode cannot cover.
 */

import { expect } from '@playwright/test';
import {
  ensureSecondarySideBarHidden,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors
} from '@salesforce/playwright-vscode-ext';
import { findTestExplorerItem, openTestExplorerAndDiscover } from '../../helpers/testExplorerHelpers';
import { containerTest as test } from '../../fixtures/containerFixtures';

test('Apex Test Explorer (Code Builder): discovers the seeded @isTest class via the Apex LSP', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await ensureSecondarySideBarHidden(page);
  });

  await test.step('open Test Explorer and discover tests', async () => {
    // Focuses the Test Explorer, runs "Test: Refresh Tests", and waits for the local rebuild.
    await openTestExplorerAndDiscover(page);
    await saveScreenshot(page, 'testExplorer.container.01-discovered.png');
  });

  await test.step('the seeded PagedResultTest class is discovered', async () => {
    await expect(findTestExplorerItem(page, 'PagedResultTest')).toBeVisible({ timeout: 60_000 });
    await saveScreenshot(page, 'testExplorer.container.02-class-visible.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
