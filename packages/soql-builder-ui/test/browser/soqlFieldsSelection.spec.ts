/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, test } from '@playwright/test';
import {
  clearAllFieldsButton,
  countCheckbox,
  emitState,
  fieldsSelect,
  mountBuilder,
  selectAllFieldsButton,
  selectValue
} from './helpers.js';

test('selects, removes, selects all, clears all, and keeps COUNT() mutually exclusive', async ({ page }) => {
  await mountBuilder(page, { query: { sObject: 'Account' } });

  await test.step('selects ordinary fields', async () => {
    await selectValue(fieldsSelect(page), ['Id', 'Name']);
    await expect
      .poll(() => page.evaluate(() => window.soqlBuilderHarness.recordedActions()))
      .toEqual([{ _tag: 'FieldsSelected', fieldNames: ['Id', 'Name'] }]);
    await emitState(page, { query: { fields: ['Id', 'Name'], sObject: 'Account' } });
  });

  await test.step('removes an ordinary field', async () => {
    await selectValue(fieldsSelect(page), ['Name']);
    await expect
      .poll(() => page.evaluate(() => window.soqlBuilderHarness.recordedActions()))
      .toEqual([
        { _tag: 'FieldsSelected', fieldNames: ['Id', 'Name'] },
        { _tag: 'FieldsSelected', fieldNames: ['Name'] }
      ]);
    await emitState(page, { query: { fields: ['Name'], sObject: 'Account' } });
  });

  await test.step('replaces ordinary fields with COUNT()', async () => {
    await countCheckbox(page).click();
    await expect
      .poll(() => page.evaluate(() => window.soqlBuilderHarness.recordedActions()))
      .toEqual([
        { _tag: 'FieldsSelected', fieldNames: ['Id', 'Name'] },
        { _tag: 'FieldsSelected', fieldNames: ['Name'] },
        { _tag: 'FieldsSelected', fieldNames: ['COUNT()'] }
      ]);
    await emitState(page, { query: { fields: ['COUNT()'], sObject: 'Account' } });
    await expect(countCheckbox(page)).toHaveJSProperty('checked', true);
    await expect(fieldsSelect(page)).toHaveJSProperty('value', []);
  });

  await test.step('replaces COUNT() with an ordinary field', async () => {
    await selectValue(fieldsSelect(page), ['Name']);
    await expect
      .poll(() => page.evaluate(() => window.soqlBuilderHarness.recordedActions()))
      .toEqual([
        { _tag: 'FieldsSelected', fieldNames: ['Id', 'Name'] },
        { _tag: 'FieldsSelected', fieldNames: ['Name'] },
        { _tag: 'FieldsSelected', fieldNames: ['COUNT()'] },
        { _tag: 'FieldsSelected', fieldNames: ['Name'] }
      ]);
    await emitState(page, { query: { fields: ['Name'], sObject: 'Account' } });
    await expect(countCheckbox(page)).toHaveJSProperty('checked', false);
  });

  await test.step('dispatches the bulk field actions', async () => {
    await selectAllFieldsButton(page).click();
    await clearAllFieldsButton(page).click();
    await expect
      .poll(() => page.evaluate(() => window.soqlBuilderHarness.recordedActions()))
      .toEqual([
        { _tag: 'FieldsSelected', fieldNames: ['Id', 'Name'] },
        { _tag: 'FieldsSelected', fieldNames: ['Name'] },
        { _tag: 'FieldsSelected', fieldNames: ['COUNT()'] },
        { _tag: 'FieldsSelected', fieldNames: ['Name'] },
        { _tag: 'AllFieldsSelected' },
        { _tag: 'AllFieldsCleared' }
      ]);
  });
});
