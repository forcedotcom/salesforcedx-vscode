/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, test } from '@playwright/test';
import { emitState, fromSelect, mountBuilder } from './helpers.js';

test('renders From loading, empty, recoverable-error, and missing-org states', async ({ page }) => {
  await test.step('reports an empty object list without disabling search', async () => {
    await mountBuilder(page, { metadata: { objects: [] } });

    await expect(fromSelect(page)).not.toHaveAttribute('disabled', '');
    await expect(page.getByText('No results found.', { exact: true })).toBeVisible();
  });

  await test.step('reports loading and disables selection until objects arrive', async () => {
    await emitState(page, { isObjectsLoading: true, metadata: { objects: [] } });

    await expect(fromSelect(page)).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('combobox', { name: 'From' })).toHaveAttribute('aria-busy', 'true');
    await expect(fromSelect(page)).toHaveAttribute('disabled', '');
    await expect(page.getByText('Loading...', { exact: true })).toBeVisible();
  });

  await test.step('marks a recoverable missing From clause invalid while preserving the form', async () => {
    await emitState(page, {
      isObjectsLoading: false,
      metadata: { objects: [{ label: 'Account', name: 'Account', queryable: true }] },
      query: {
        parseErrors: [
          {
            charInLine: 9,
            lineNumber: 1,
            message: 'Expected an object after FROM',
            type: 'INCOMPLETEFROM'
          }
        ]
      }
    });

    await expect(page.getByRole('form', { name: 'Query inputs' })).toBeVisible();
    await expect(fromSelect(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('combobox', { name: 'From' })).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('From*', { exact: true })).toBeVisible();
  });

  await test.step('replaces the form with the established missing-default-org alert', async () => {
    await emitState(page, { hasNoDefaultOrg: true, metadata: { objects: [] } });

    await expect(page.getByRole('alert')).toHaveText('No default org');
    await expect(page.getByRole('form', { name: 'Query inputs' })).toHaveCount(0);
  });
});

test('renders restored and externally updated From selections', async ({ page }) => {
  await test.step('restores the selected object at mount', async () => {
    await mountBuilder(page, { query: { sObject: 'Account' } });
    await expect
      .poll(() =>
        fromSelect(page).evaluate(node => {
          if (!('value' in node) || typeof node.value !== 'string') throw new Error('Expected a single select');
          return node.value;
        })
      )
      .toBe('Account');
  });

  await test.step('reflects a newer object selected by an external document update', async () => {
    await emitState(page, {
      query: { originalSoqlStatement: 'SELECT Id FROM Contact', sObject: 'Contact' }
    });
    await expect
      .poll(() =>
        fromSelect(page).evaluate(node => {
          if (!('value' in node) || typeof node.value !== 'string') throw new Error('Expected a single select');
          return node.value;
        })
      )
      .toBe('Contact');
  });
});
