/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, test } from '@playwright/test';
import { allRowsCheckbox, limitTextfield, mountBuilder, setCheckboxChecked, setTextfieldValue } from './helpers.js';

test('dispatches typed Limit and All Rows actions through VSCode Elements public APIs', async ({ page }) => {
  await mountBuilder(page, { query: { sObject: 'Account' } });

  await test.step('maps input and change events to explicit limit states', async () => {
    await setTextfieldValue(limitTextfield(page), '25', 'input');
    await setTextfieldValue(limitTextfield(page), '50', 'change');
    await setTextfieldValue(limitTextfield(page), '-1', 'input');
    await setTextfieldValue(limitTextfield(page), '', 'change');
  });

  await test.step('maps checkbox changes to All Rows actions', async () => {
    await setCheckboxChecked(allRowsCheckbox(page), true);
    await setCheckboxChecked(allRowsCheckbox(page), false);
  });

  await expect
    .poll(() => page.evaluate(() => window.soqlBuilderHarness.recordedActions()))
    .toEqual([
      { _tag: 'LimitChanged', limit: { _tag: 'Valid', value: 25 } },
      { _tag: 'LimitChanged', limit: { _tag: 'Valid', value: 50 } },
      { _tag: 'LimitChanged', limit: { _tag: 'Invalid', input: '-1' } },
      { _tag: 'LimitChanged', limit: { _tag: 'Empty' } },
      { _tag: 'AllRowsChanged', allRows: true },
      { _tag: 'AllRowsChanged', allRows: false }
    ]);
});
