/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, test } from '@playwright/test';
import { mountBuilder } from './helpers.js';

test('searches and keyboard-selects an object from a large catalog', async ({ page }) => {
  const objects = Array.from({ length: 3000 }, (_, index) => ({
    label: `Generated Object ${String(index).padStart(4, '0')}`,
    name: `GeneratedObject${index}__c`,
    queryable: true
  }));
  objects.push({ label: 'Target Account', name: 'TargetAccount__c', queryable: true });

  await mountBuilder(page, { metadata: { objects } });
  const from = page.getByRole('combobox', { name: 'From' });

  await test.step('announces a search with no matching objects', async () => {
    await from.fill('DoesNotExist');
    await expect(page.getByText('No results found.', { exact: true })).toBeVisible();
  });

  await test.step('keeps the announcement aligned with the label-only control filter', async () => {
    await from.fill('TargetAccount__c');
    await expect(page.getByRole('option', { name: 'Target Account' })).toBeHidden();
    await expect(page.getByText('No results found.', { exact: true })).toBeVisible();
  });

  await test.step('filters the large catalog using the public combobox', async () => {
    await from.fill('Target');
    await expect(page.getByRole('option', { name: 'Target Account' })).toBeVisible();
  });

  await test.step('selects the filtered option without a pointer', async () => {
    await from.press('ArrowDown');
    await from.press('Enter');
    await expect
      .poll(() => page.evaluate(() => window.soqlBuilderHarness.recordedActions()))
      .toEqual([{ _tag: 'ObjectSelected', objectName: 'TargetAccount__c' }]);
  });
});
