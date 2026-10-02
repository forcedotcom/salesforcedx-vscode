/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isContainer, oasTest as test } from '../fixtures/oasSharedTest';
import { expect } from '@playwright/test';
import {
  closeWelcomeTabs,
  createApexClass,
  ensureSecondarySideBarHidden,
  executeCommandWithCommandPalette,
  NOTIFICATION_LIST_ITEM,
  openFileByName
} from '@salesforce/playwright-vscode-ext';
import { pushSource, setupWorkbenchAndAuth, waitForA4VAndOasCommands } from '../utils/oasHelpers';

test.setTimeout(360_000);

// Unique per run: on container's shared, persistent workbench/org this avoids colliding with a prior
// run or retry (desktop always gets a fresh org/workspace, so this is harmless there too).
const CLASS_NAME = `RestResourceNoHttpMethod${Date.now()}`;
const CLASS_CONTENT = [
  `@RestResource(urlMapping='/apex-rest-examples/v1/noHttp-${CLASS_NAME}/*')`,
  `global with sharing class ${CLASS_NAME} {`,
  '  global static Account getAccount(Id accountId) {',
  '    return [SELECT Id, Name, Phone, Website FROM Account WHERE Id = :accountId];',
  '  }',
  '}'
].join('\n');

// @RestResource without an @Http___ method passes eligibility and the mixed-frameworks check, but no
// generation strategy qualifies. Asserts the early Step 2.6 guard fails fast with apex_class_not_valid
// instead of slipping through to generation and failing late.
test('OAS: @RestResource class without an @Http method shows class-not-valid error notification', async ({ page }) => {
  await test.step('setup workbench + auth', async () => {
    // Container boots with the org already authed by the orchestrator; desktop must create it
    // (idempotently — reuses the shared org if already created) before this spec can hit real APIs.
    if (isContainer) {
      await closeWelcomeTabs(page);
      await ensureSecondarySideBarHidden(page);
    } else {
      await setupWorkbenchAndAuth(page);
    }
  });

  await test.step('wait for A4V + OAS commands available', async () => {
    await waitForA4VAndOasCommands(page);
  });

  await test.step('create REST-resource-without-http-method class and push', async () => {
    await createApexClass(page, CLASS_NAME, CLASS_CONTENT);
    await pushSource(page);
  });

  await test.step('attempt OAS generation and assert class-not-valid failure notification', async () => {
    await openFileByName(page, `${CLASS_NAME}.cls`);
    await executeCommandWithCommandPalette(page, 'SFDX: Create OpenAPI Document from This Class');

    const failureNotification = page.locator(NOTIFICATION_LIST_ITEM).filter({
      hasText: new RegExp(`The Apex Class ${CLASS_NAME} is not valid for OpenAPI document generation`, 'i')
    });
    await expect(failureNotification.first()).toBeVisible({ timeout: 180_000 });
  });
});
