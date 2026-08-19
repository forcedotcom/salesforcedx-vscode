/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidSObjectName } from '../out/src/salesforceOrgDataSource.js';
import { parseServerOptions } from '../out/src/serverOptions.js';

test('requires an explicit alias or username', () => {
  assert.throws(() => parseServerOptions([]), /--target-org/);
});

test('accepts explicit target-org and port arguments', () => {
  assert.deepEqual(parseServerOptions(['--target-org', 'builder-demo', '--port=5000']), {
    port: 5000,
    targetOrg: 'builder-demo'
  });
});

test('rejects unsafe object API names', () => {
  assert.equal(isValidSObjectName('Account'), true);
  assert.equal(isValidSObjectName('Invoice__c'), true);
  assert.equal(isValidSObjectName('../Account'), false);
  assert.equal(isValidSObjectName('Account; rm'), false);
});
