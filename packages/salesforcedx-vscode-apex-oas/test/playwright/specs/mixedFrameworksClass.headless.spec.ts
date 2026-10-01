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
import { mixedFrameworksClassText } from '../testData/sampleClassData';
import { pushSource, setupWorkbenchAndAuth, waitForA4VAndOasCommands } from '../utils/oasHelpers';

test.setTimeout(360_000);

test('OAS: class mixing Apex REST and AuraEnabled frameworks shows error notification', async ({ page }) => {
  await test.step('setup workbench + auth', async () => {
    await setupWorkbenchAndAuth(page);
  });

  await test.step('wait for A4V + OAS commands available', async () => {
    await waitForA4VAndOasCommands(page);
  });

  await test.step('create mixed-frameworks class and push', async () => {
    await createApexClass(page, 'MixedFrameworksClass', mixedFrameworksClassText);
    await pushSource(page);
  });

  await test.step('attempt OAS generation and assert mixed-frameworks failure notification', async () => {
    await openFileByName(page, 'MixedFrameworksClass.cls');
    await executeCommandWithCommandPalette(page, 'SFDX: Create OpenAPI Document from This Class');

    const failureNotification = page
      .locator(NOTIFICATION_LIST_ITEM)
      .filter({
        hasText:
          /The Apex Class MixedFrameworksClass mixes Apex Rest and AuraEnabled frameworks, which is not allowed for OpenAPI document generation/i
      })
      .first();
    await expect(failureNotification).toBeVisible({ timeout: 180_000 });
  });
});
