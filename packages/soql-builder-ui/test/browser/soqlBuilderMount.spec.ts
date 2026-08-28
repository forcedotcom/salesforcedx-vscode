/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, test } from '@playwright/test';
import { expectFormAssociation, fieldsSelect, fromSelect, mountBuilder } from './helpers.js';

test('mounts with accessible roles, labels, keyboard focus, and form association', async ({ page }) => {
  await mountBuilder(page, { query: { sObject: 'Account' } });

  await test.step('exposes accessible roles, labels, and form association', async () => {
    await expect(page.getByRole('form', { name: 'Query inputs' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'From' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Fields' })).toBeVisible();
    await expect(page.getByRole('status')).toContainText('Query preview');
    await expectFormAssociation(page);
  });

  await test.step('moves keyboard focus across the query inputs', async () => {
    await page.getByRole('combobox', { name: 'From' }).focus();
    await expect.poll(() => fromSelect(page).evaluate(node => node.matches(':focus-within'))).toBe(true);
    await page.keyboard.press('Tab');
    await expect.poll(() => fieldsSelect(page).evaluate(node => node.matches(':focus-within'))).toBe(true);
  });
});
