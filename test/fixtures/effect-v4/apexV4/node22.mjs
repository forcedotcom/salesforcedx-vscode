/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { executeAnonymous } from '@salesforce/apex-node/effect';
import * as Effect from 'effect/Effect';

assert.equal(process.version, 'v22.0.0');
const require = createRequire(import.meta.url);
const { executeAnonymousExit } = require('@salesforce/apex-node/execute-anonymous-compat');
const connection = {
  accessToken: '00D000000000001!token',
  instanceUrl: 'https://example.my.salesforce.com',
  version: '67.0',
  request: async () => ({
    'soapenv:Envelope': {
      'soapenv:Body': {
        executeAnonymousResponse: {
          result: {
            compiled: 'true',
            success: 'true',
            line: '-1',
            column: '-1',
            compileProblem: '',
            exceptionMessage: '',
            exceptionStackTrace: ''
          }
        }
      }
    }
  })
};
assert.equal((await Effect.runPromise(executeAnonymous(connection, { apexCode: 'code' }))).success, true);
assert.equal(
  (await executeAnonymousExit(connection, { apexCode: 'code' }, new AbortController().signal))._tag,
  'Success'
);
console.log('PASS native Node 22.0.0 V4 ESM operation and CJS Promise/data entry (not the SDK-dependent root)');
