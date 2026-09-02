/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, test } from '@playwright/test';
import { makeField, mountBuilder } from './helpers.js';

test('searches and keyboard-selects a field from a large catalog', async ({ page }) => {
  const fields = Array.from({ length: 3000 }, (_, index) =>
    makeField(`GeneratedField${index}__c`, `Generated Field ${String(index).padStart(4, '0')}`)
  );
  fields.push(makeField('TargetField__c', 'Target Field'));

  await mountBuilder(page, { metadata: { fields }, query: { sObject: 'Account' } });
  const fieldsCombobox = page.getByRole('combobox', { name: 'Fields' });

  await test.step('announces a search with no matching fields', async () => {
    await fieldsCombobox.fill('DoesNotExist');
    await expect(page.getByText('No results found.', { exact: true })).toBeVisible();
  });

  await test.step('clears the announcement when the control resets its filter on focus', async () => {
    await fieldsCombobox.blur();
    await fieldsCombobox.focus();
    await expect(page.getByText('No results found.', { exact: true })).toBeHidden();
  });

  await test.step('filters by API name or label', async () => {
    await fieldsCombobox.fill('TargetField__c');
    await expect(page.getByRole('option', { name: 'TargetField__c — Target Field' })).toBeVisible();
  });

  await test.step('selects the filtered field without a pointer', async () => {
    await fieldsCombobox.press('ArrowDown');
    await fieldsCombobox.press('Enter');
    await expect
      .poll(() => page.evaluate(() => window.soqlBuilderHarness.recordedActions()))
      .toEqual([{ _tag: 'FieldsSelected', fieldNames: ['TargetField__c'] }]);
  });
});
