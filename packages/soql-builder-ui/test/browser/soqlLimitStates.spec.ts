/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, test } from '@playwright/test';
import { allRowsCheckbox, emitState, limitTextfield, mountBuilder } from './helpers.js';

test('renders restored, invalid, recoverable-error, and external Limit and All Rows states', async ({ page }) => {
  await test.step('restores a valid limit and checked All Rows state', async () => {
    await mountBuilder(page, {
      query: { allRows: true, limit: { _tag: 'Valid', value: 10 }, sObject: 'Account' }
    });
    await expect(limitTextfield(page)).toHaveJSProperty('value', '10');
    await expect(allRowsCheckbox(page)).toHaveJSProperty('checked', true);
  });

  await test.step('reflects external updates', async () => {
    await emitState(page, { query: { allRows: false, limit: { _tag: 'Empty' } } });
    await expect(limitTextfield(page)).toHaveJSProperty('value', '');
    await expect(allRowsCheckbox(page)).toHaveJSProperty('checked', false);
  });

  await test.step('associates local validation errors with the numeric input', async () => {
    await emitState(page, { query: { limit: { _tag: 'Invalid', input: '1.5' }, parseErrors: [] } });
    const error = page.getByText('Enter a whole number greater than or equal to 0.', { exact: true });
    await expect(error).toBeVisible();
    await expect(limitTextfield(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(limitTextfield(page)).toHaveAttribute('aria-describedby', 'soql-limit-error');
    await expect(page.getByRole('spinbutton', { name: 'Limit' })).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('spinbutton', { name: 'Limit' })).toHaveAccessibleDescription(
      'Enter a whole number greater than or equal to 0.'
    );
  });

  await test.step('renders the parser message for a recoverable incomplete LIMIT clause', async () => {
    await emitState(page, {
      query: {
        limit: { _tag: 'Empty' },
        parseErrors: [
          {
            charInLine: 36,
            lineNumber: 1,
            message: 'The LIMIT keyword must be followed by a number.',
            type: 'INCOMPLETELIMIT'
          }
        ]
      }
    });
    const errorMessage = 'The LIMIT keyword must be followed by a number.';
    await expect(page.getByText(errorMessage, { exact: true })).toBeVisible();
    await expect(page.getByText('Limit*', { exact: true })).toBeVisible();
    await expect(page.getByRole('spinbutton', { name: 'Limit' })).toHaveAccessibleDescription(errorMessage);
  });
});
