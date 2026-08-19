/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialSoqlBuilderState } from '../out/src/contracts.js';

test('creates independent empty SOQL Builder states', () => {
  const first = createInitialSoqlBuilderState();
  const second = createInitialSoqlBuilderState();

  first.sObjects.push('Account');
  first.query.fields.push('Id');

  assert.deepEqual(second.sObjects, []);
  assert.deepEqual(second.query.fields, []);
  assert.equal(second.query.originalSoqlStatement, '');
});
