/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { test } from '../fixtures';
import { expect } from '@playwright/test';
import {
  createApexClass,
  executeCommandWithCommandPalette,
  NOTIFICATION_LIST_ITEM,
  openFileByName
} from '@salesforce/playwright-vscode-ext';
import { restResourceNoHttpMethodClassText } from '../testData/sampleClassData';
import { pushSource, setupWorkbenchAndAuth, waitForA4VAndOasCommands } from '../utils/oasHelpers';

test.setTimeout(360_000);

// @RestResource without an @Http___ method passes eligibility and the mixed-frameworks check, but no
// generation strategy qualifies. Asserts the early Step 2.6 guard fails fast with apex_class_not_valid
// instead of slipping through to generation and failing late.
test('OAS: @RestResource class without an @Http method shows class-not-valid error notification', async ({ page }) => {
  await test.step('setup workbench + auth', async () => {
    await setupWorkbenchAndAuth(page);
  });

  await test.step('wait for A4V + OAS commands available', async () => {
    await waitForA4VAndOasCommands(page);
  });

  await test.step('create REST-resource-without-http-method class and push', async () => {
    await createApexClass(page, 'RestResourceNoHttpMethod', restResourceNoHttpMethodClassText);
    await pushSource(page);
  });

  await test.step('attempt OAS generation and assert class-not-valid failure notification', async () => {
    await openFileByName(page, 'RestResourceNoHttpMethod.cls');
    await executeCommandWithCommandPalette(page, 'SFDX: Create OpenAPI Document from This Class');

    const failureNotification = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({
        hasText: /The Apex Class RestResourceNoHttpMethod is not valid for OpenAPI document generation/i
      })
      .first();
    await expect(failureNotification).toBeVisible({ timeout: 180_000 });
  });
});
