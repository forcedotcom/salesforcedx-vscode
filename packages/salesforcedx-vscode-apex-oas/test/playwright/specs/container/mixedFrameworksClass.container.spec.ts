/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Container parity for the OpenAPI-document command's mixed-frameworks guard. The web twin
 * (mixedFrameworksClass.headless.spec.ts) proves the ineligibility path against a plain Page; this
 * proves the apex-oas command is wired and its Apex-LSP-backed check runs inside the Code Builder image.
 *
 * A class that mixes Apex REST (@RestResource + @HttpGet) with an @AuraEnabled method is not allowed
 * for OAS generation. This guard fails BEFORE any LLM call, so it needs no A4V/Einstein service and is
 * free of the shared LLM rate limit. The seeded fixture has no mixed-frameworks class, so this authors
 * a uniquely-named one and pushes it to the boot org (one tracking scratch org authed as default
 * target-org). We only verify the OAS command exists then run it — we do NOT wait for the A4V/LLM
 * extension and never trigger actual generation.
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
const CLASS_NAME = `CbMixedFrameworks${Date.now()}`;
const CLASS_CONTENT = [
  `@RestResource(urlMapping='/apex-rest-examples/v1/mixed-${CLASS_NAME}/*')`,
  `global with sharing class ${CLASS_NAME} {`,
  '  @HttpGet',
  '  global static Account getAccount() {',
  '    RestRequest req = RestContext.request;',
  "    String accountId = req.requestURI.substring(req.requestURI.lastIndexOf('/')+1);",
  '    return [SELECT Id, Name, Phone, Website FROM Account WHERE Id = :accountId];',
  '  }',
  '',
  '  @AuraEnabled',
  '  public static Account getAccountForAura(Id accountId) {',
  '    return [SELECT Id, Name, Phone, Website FROM Account WHERE Id = :accountId];',
  '  }',
  '}'
].join('\n');

// Shared persistent workbench: reset editors + notifications so each spec starts from a known state.
test.beforeEach(async ({ page }) => {
  await closeAllEditors(page);
  await clearAllNotifications(page);
});

test('OAS mixed frameworks (Code Builder): rejects a class mixing Apex REST and AuraEnabled', async ({ page }) => {
  test.setTimeout(6 * 60 * 1000);
  const consoleErrors = setupConsoleMonitoring(page);
  const networkErrors = setupNetworkMonitoring(page);

  await test.step('workbench ready', async () => {
    // The containerTest fixture already awaited workbench readiness before handing over `page`.
    await closeWelcomeTabs(page);
    await ensureSecondarySideBarHidden(page);
    await saveScreenshot(page, 'oasMixed.container.01-ready.png');
  });

  await test.step('create the mixed-frameworks class and push to the boot org', async () => {
    await createApexClass(page, CLASS_NAME, CLASS_CONTENT);
    await pushSource(page);
    await saveScreenshot(page, 'oasMixed.container.02-pushed.png');
  });

  await test.step('command is present (apex-oas activated in the Node host)', async () => {
    // Wait generously: the command registers after the Apex language server has indexed the class.
    await verifyCommandExists(page, packageNls.create_openapi_doc_class, 120_000);
  });

  await test.step('run Create OpenAPI Document and assert the mixed-frameworks error', async () => {
    await openFileByName(page, `${CLASS_NAME}.cls`);
    await executeCommandWithCommandPalette(page, packageNls.create_openapi_doc_class);

    const notification = page.locator(NOTIFICATION_LIST_ITEM).filter({
      hasText: new RegExp(
        `The Apex Class ${CLASS_NAME} mixes Apex Rest and AuraEnabled frameworks, which is not allowed for OpenAPI document generation`,
        'i'
      )
    });
    await expect(notification.first()).toBeVisible({ timeout: 60_000 });
    await saveScreenshot(page, 'oasMixed.container.03-error.png');
  });

  await validateNoCriticalErrors(test, consoleErrors, networkErrors);
});
