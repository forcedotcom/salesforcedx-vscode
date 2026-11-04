/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from '@playwright/test';
import {
  createApexClass,
  executeCommandWithCommandPalette,
  NOTIFICATION_LIST_ITEM,
  openFileByName
} from '@salesforce/playwright-vscode-ext';
import { test } from '../fixtures';
import { restResourceClassText } from '../testData/sampleClassData';
import { pushSource, setupWorkbenchAndAuth, waitForOasCommands } from '../utils/oasHelpers';

test.setTimeout(360_000);

test('OAS: REST resource generation is retired', async ({ page }) => {
  await test.step('setup workbench, auth, and commands', async () => {
    await setupWorkbenchAndAuth(page);
    await waitForOasCommands(page);
  });

  await test.step('create and deploy the REST resource', async () => {
    await createApexClass(page, 'RestResourceClass', restResourceClassText);
    await pushSource(page);
  });

  await test.step('reject generation without creating an ESR', async () => {
    await openFileByName(page, 'RestResourceClass.cls');
    await executeCommandWithCommandPalette(page, 'SFDX: Create OpenAPI Document from This Class');
    await expect(
      page
        .locator(NOTIFICATION_LIST_ITEM)
        .filter({
          hasText: /OpenAPI document generation for Apex REST \(@RestResource\) classes is no longer supported\./
        })
        .first()
    ).toBeVisible({ timeout: 180_000 });
    await expect(page.getByRole('tab', { name: 'RestResourceClass.externalServiceRegistration-meta.xml' })).toHaveCount(
      0
    );
    await expect(page.getByText('RestResourceClass.externalServiceRegistration-meta.xml', { exact: true })).toHaveCount(
      0
    );
  });
});
