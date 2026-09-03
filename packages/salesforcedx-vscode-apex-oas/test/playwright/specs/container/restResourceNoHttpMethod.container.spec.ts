/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the OpenAPI-document command's early "no qualifying strategy" guard.
 * The web twin (restResourceNoHttpMethod.headless.spec.ts) proves the path against a plain Page; this
 * proves the apex-oas command is wired and its Apex-LSP-backed check runs inside the Code Builder image.
 *
 * A @RestResource class with no @Http___ method passes eligibility and the mixed-frameworks check, but
 * no generation strategy qualifies — so the early guard must fail fast with the class-not-valid error
 * instead of slipping through to generation. This guard fails BEFORE any LLM call, so it needs no
 * A4V/Einstein service and is free of the shared LLM rate limit. The seeded fixture has no such class,
 * so this authors a uniquely-named one and pushes it to the boot org (one tracking scratch org authed
 * as default target-org). We only verify the OAS command exists then run it — we do NOT wait for the
 * A4V/LLM extension and never trigger actual generation.
 */

import { expect } from '@playwright/test';
import {
  clearAllNotifications,
  closeAllEditors,
  closeWelcomeTabs,
  createApexClass,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  NOTIFICATION_LIST_ITEM,
  openFileByName,
  saveScreenshot,
  setupConsoleMonitoring,
  setupNetworkMonitoring,
  validateNoCriticalErrors,
  verifyCommandExists
} from '@salesforce/playwright-vscode-ext';
import packageNls from '../../../../package.nls.json';
import { containerTest as test } from '../../fixtures/containerFixtures';
import { pushSource } from '../../utils/oasHelpers';

// Unique per run so the shared, persistent workbench/org never collides across specs or retries.
const CLASS_NAME = `CbRestNoHttp${Date.now()}`;
const CLASS_CONTENT = [
  `@RestResource(urlMapping='/apex-rest-examples/v1/noHttp-${CLASS_NAME}/*')`,
  `global with sharing class ${CLASS_NAME} {`,
  '  global static Account getAccount(Id accountId) {',
  '    return [SELECT Id, Name, Phone, Website FROM Account WHERE Id = :accountId];',
  '  }',
  '}'
].join('\n');

// Shared persistent workbench: reset editors + notifications so each spec starts from a known state.
test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('OAS no-http-method (Code Builder): rejects a @RestResource class with no @Http method', async ({ page }) => {
  test.setTimeout(6 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'oasNoHttp.container.01-ready.png');
  });

  await test.step('create the REST-resource-without-http-method class and push to the boot org', async () => {
    await createApexClass(page, CLASS_NAME, CLASS_CONTENT);
    await pushSource(page);
    await saveScreenshot(page, 'oasNoHttp.container.02-pushed.png');
  });

  await test.step('command is present (apex-oas activated in the Node host)', async () => {
    // Wait generously: the command registers after the Apex language server has indexed the class.
    await verifyCommandExists(page, packageNls.create_openapi_doc_class, 120_000);
  });

  await test.step('run Create OpenAPI Document and assert the class-not-valid error', async () => {
    await openFileByName(page, `${CLASS_NAME}.cls`);
    await executeCommandWithCommandPalette(page, packageNls.create_openapi_doc_class);

    const notification = page.locator(NOTIFICATION_LIST_ITEM).filter({
      hasText: new RegExp(`The Apex Class ${CLASS_NAME} is not valid for OpenAPI document generation`, 'i')
    });
    await expect(notification.first()).toBeVisible({ timeout: 60_000 });
    await saveScreenshot(page, 'oasNoHttp.container.03-error.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
