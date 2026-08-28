/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, test } from '@playwright/test';
import { emitState, fieldsSelect, fromSelect, mountBuilder } from './helpers.js';

test('renders loading, disabled, live status, and alert states from the fake service', async ({ page }) => {
  await test.step('renders loading, disabled, and live status states', async () => {
    await mountBuilder(page, {
      isFieldsLoading: true,
      isObjectsLoading: true,
      query: { originalSoqlStatement: 'SELECT Id FROM Account' }
    });

    await expect(page.getByRole('form', { name: 'Query inputs' })).toHaveAttribute('aria-busy', 'true');
    await expect(fromSelect(page)).toHaveAttribute('disabled', '');
    await expect(fieldsSelect(page)).toHaveAttribute('disabled', '');
    await expect(page.getByRole('status')).toContainText('SELECT Id FROM Account');
  });

  await test.step('clears loading and disabled states on the next emitted state', async () => {
    await emitState(page, {
      isFieldsLoading: false,
      isObjectsLoading: false,
      query: { sObject: 'Account' }
    });
    await expect(page.getByRole('form', { name: 'Query inputs' })).toHaveAttribute('aria-busy', 'false');
    await expect(fromSelect(page)).not.toHaveAttribute('disabled', '');
    await expect(fieldsSelect(page)).not.toHaveAttribute('disabled', '');
  });

  await test.step('renders an alert when the service fails', async () => {
    await page.evaluate(() => window.soqlBuilderHarness.fail('Metadata subscription failed'));
    await expect(page.getByRole('alert')).toHaveText('Metadata subscription failed');
  });
});
