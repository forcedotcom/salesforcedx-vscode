/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the OpenAPI-document command's eligibility gate (ADR 0022). The web twin
 * (ineligibleClass.headless.spec.ts) proves the ineligibility path against a plain Page; this proves
 * the apex-oas command is wired and its Apex-LSP-backed eligibility check runs inside the Code
 * Builder image.
 *
 * The seeded fixture's PagedResult is a plain class with no @RestResource/@AuraEnabled methods, so
 * it is ineligible — the command must reject it with a clear error. This path fails BEFORE any LLM
 * call, so it needs no A4V/Einstein service and no org round-trip (eligibility is decided from the
 * class's Apex-LSP symbols in the workspace), keeping it fast and free of the shared LLM rate limit.
 */

import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  NOTIFICATION_LIST_ITEM,
  openFileFromExplorerTree,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';

test('OpenAPI eligibility (Code Builder): rejects an ineligible Apex class with a clear error', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'oasIneligible.container.01-ready.png');
  });

  await test.step('open the ineligible fixture class', async () => {
    await openFileFromExplorerTree(page, 'PagedResult.cls', ['force-app', 'main', 'default', 'classes']);
    await expect(page.getByText('public with sharing class PagedResult').first()).toBeVisible({ timeout: 15_000 });
  });

  await test.step('command is present (apex-oas activated in the Node host)', async () => {
    // Wait generously: the command registers after the Apex language server has indexed the class.
    await verifyCommandExists(page, packageNls.create_openapi_doc_class, 120_000);
  });

  await test.step('run Create OpenAPI Document and assert the ineligibility error', async () => {
    await executeCommandWithCommandPalette(page, packageNls.create_openapi_doc_class);
    const notification = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({ hasText: /The Apex Class PagedResult is not valid for OpenAPI document generation/i });
    await expect(notification.first()).toBeVisible({ timeout: 60_000 });
    await saveScreenshot(page, 'oasIneligible.container.02-error.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
