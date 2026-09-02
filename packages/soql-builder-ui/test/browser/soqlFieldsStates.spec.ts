/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, test } from '@playwright/test';
import { countCheckbox, emitState, fieldsSelect, makeField, mountBuilder, selectAllFieldsButton } from './helpers.js';

test('renders Fields loading, empty, recoverable-error, restored, and external-update states', async ({ page }) => {
  await test.step('disables Fields until an object is selected', async () => {
    await mountBuilder(page, { metadata: { fields: [] } });
    await expect(fieldsSelect(page)).toHaveAttribute('disabled', '');
    await expect(countCheckbox(page)).toHaveAttribute('disabled', '');
    await expect(selectAllFieldsButton(page)).toHaveAttribute('disabled', '');
  });

  await test.step('announces loading while object metadata is pending', async () => {
    await emitState(page, { isFieldsLoading: true, query: { sObject: 'Account' } });
    await expect(fieldsSelect(page)).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('combobox', { name: 'Fields' })).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByText('Loading...', { exact: true })).toBeVisible();
  });

  await test.step('keeps COUNT() available when the ordinary field list is empty', async () => {
    await emitState(page, {
      isFieldsLoading: false,
      metadata: { fields: [] },
      query: { sObject: 'Account' }
    });
    await expect(fieldsSelect(page)).not.toHaveAttribute('disabled', '');
    await expect(countCheckbox(page)).not.toHaveAttribute('disabled', '');
    await expect(page.getByText('No results found.', { exact: true })).toBeVisible();
  });

  await test.step('marks a recoverable missing SELECT clause invalid', async () => {
    await emitState(page, {
      metadata: { fields: [makeField('Id', 'Record ID')] },
      query: {
        parseErrors: [
          {
            charInLine: 7,
            lineNumber: 1,
            message: 'Expected at least one selected field',
            type: 'NOSELECT'
          }
        ],
        sObject: 'Account'
      }
    });
    await expect(fieldsSelect(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('combobox', { name: 'Fields' })).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Fields*', { exact: true })).toBeVisible();
  });

  await test.step('restores ordinary fields and reflects an external COUNT() update', async () => {
    await emitState(page, {
      metadata: { fields: [makeField('Id', 'Record ID'), makeField('Name', 'Account Name')] },
      query: { fields: ['Id', 'Name'], parseErrors: [], sObject: 'Account' }
    });
    await expect(fieldsSelect(page)).toHaveJSProperty('value', ['Id', 'Name']);

    await emitState(page, { query: { fields: ['COUNT()'], sObject: 'Account' } });
    await expect(fieldsSelect(page)).toHaveJSProperty('value', []);
    await expect(countCheckbox(page)).toHaveJSProperty('checked', true);
  });
});
