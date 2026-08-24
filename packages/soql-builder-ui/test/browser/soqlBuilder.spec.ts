/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, test } from '@playwright/test';
import {
  builder,
  emitState,
  expectFormAssociation,
  fieldsSelect,
  fromSelect,
  mountBuilder,
  selectValue
} from './helpers.js';

test('mounts with accessible roles, labels, keyboard focus, and form association', async ({ page }) => {
  await mountBuilder(page, { query: { sObject: 'Account' } });

  await expect(page.getByRole('form', { name: 'Query inputs' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'From' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Fields' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Query preview');
  await expectFormAssociation(page);

  await page.getByRole('combobox', { name: 'From' }).focus();
  await expect.poll(() => fromSelect(page).evaluate(node => node.matches(':focus-within'))).toBe(true);
  await page.keyboard.press('Tab');
  await expect.poll(() => fieldsSelect(page).evaluate(node => node.matches(':focus-within'))).toBe(true);
});

test('renders loading, disabled, live status, and alert states from the fake service', async ({ page }) => {
  await mountBuilder(page, {
    isFieldsLoading: true,
    isObjectsLoading: true,
    query: { originalSoqlStatement: 'SELECT Id FROM Account' }
  });

  await expect(page.getByRole('form', { name: 'Query inputs' })).toHaveAttribute('aria-busy', 'true');
  await expect(fromSelect(page)).toHaveAttribute('disabled', '');
  await expect(fieldsSelect(page)).toHaveAttribute('disabled', '');
  await expect(page.getByRole('status')).toContainText('SELECT Id FROM Account');

  await emitState(page, {
    isFieldsLoading: false,
    isObjectsLoading: false,
    query: { sObject: 'Account' }
  });
  await expect(page.getByRole('form', { name: 'Query inputs' })).toHaveAttribute('aria-busy', 'false');
  await expect(fromSelect(page)).not.toHaveAttribute('disabled', '');
  await expect(fieldsSelect(page)).not.toHaveAttribute('disabled', '');

  await page.evaluate(() => window.soqlBuilderHarness.fail('Metadata subscription failed'));
  await expect(page.getByRole('alert')).toHaveText('Metadata subscription failed');
});

test('dispatches typed actions through VSCode Elements public APIs', async ({ page }) => {
  await mountBuilder(page, { query: { sObject: 'Account' } });

  await selectValue(fromSelect(page), 'Contact');
  await selectValue(fieldsSelect(page), ['Id', 'Name']);

  await expect
    .poll(() => page.evaluate(() => window.soqlBuilderHarness.recordedActions()))
    .toEqual([
      { _tag: 'ObjectSelected', objectName: 'Contact' },
      { _tag: 'FieldsSelected', fieldNames: ['Id', 'Name'] }
    ]);
});

test('surfaces typed dispatch failures and releases the failed application scope', async ({ page }) => {
  await mountBuilder(page);
  await page.evaluate(() => window.soqlBuilderHarness.failNextDispatch('Object selection failed'));

  await selectValue(fromSelect(page), 'Account');

  await expect(page.getByRole('alert')).toHaveText('Object selection failed');
  await expect
    .poll(() => page.evaluate(() => window.soqlBuilderHarness.stats()))
    .toMatchObject({ activeLayers: 0, activeSubscriptions: 0, dispatchesInFlight: 0 });
});

test('reconnects once, avoids duplicate subscriptions, and cleans up all resources', async ({ page }) => {
  await mountBuilder(page);

  await page.evaluate(() => window.soqlBuilderHarness.connectAgain());
  await expect
    .poll(() => page.evaluate(() => window.soqlBuilderHarness.stats()))
    .toMatchObject({ acquisitions: 1, activeLayers: 1, activeSubscriptions: 1, releases: 0 });

  await page.evaluate(() => window.soqlBuilderHarness.reconnect());
  await expect(builder(page)).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.soqlBuilderHarness.stats()))
    .toMatchObject({ acquisitions: 2, activeLayers: 1, activeSubscriptions: 1, releases: 1 });

  await page.evaluate(() => window.soqlBuilderHarness.unmount());
  await expect
    .poll(() => page.evaluate(() => window.soqlBuilderHarness.stats()))
    .toMatchObject({ acquisitions: 2, activeLayers: 0, activeSubscriptions: 0, dispatchesInFlight: 0, releases: 2 });
});

test('cancels a latent action when the component disconnects', async ({ page }) => {
  await mountBuilder(page);
  await page.evaluate(() => window.soqlBuilderHarness.setDispatchLatency(60_000));
  await selectValue(fromSelect(page), 'Account');
  await expect
    .poll(() => page.evaluate(() => window.soqlBuilderHarness.stats()))
    .toMatchObject({ dispatchesInFlight: 1 });

  await page.evaluate(() => window.soqlBuilderHarness.unmount());

  await expect(page.evaluate(() => window.soqlBuilderHarness.recordedActions())).resolves.toEqual([]);
  await expect(page.evaluate(() => window.soqlBuilderHarness.stats())).resolves.toMatchObject({
    activeLayers: 0,
    activeSubscriptions: 0,
    dispatchesInFlight: 0,
    releases: 1
  });
});
