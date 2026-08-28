/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, test } from '@playwright/test';
import { fieldsSelect, fromSelect, mountBuilder, selectValue } from './helpers.js';

test('dispatches typed actions through VSCode Elements public APIs', async ({ page }) => {
  await mountBuilder(page, { query: { sObject: 'Account' } });

  await test.step('selects an object and fields through the public value contract', async () => {
    await selectValue(fromSelect(page), 'Contact');
    await selectValue(fieldsSelect(page), ['Id', 'Name']);
  });

  await test.step('records the typed actions in dispatch order', async () => {
    await expect
      .poll(() => page.evaluate(() => window.soqlBuilderHarness.recordedActions()))
      .toEqual([
        { _tag: 'ObjectSelected', objectName: 'Contact' },
        { _tag: 'FieldsSelected', fieldNames: ['Id', 'Name'] }
      ]);
  });
});
