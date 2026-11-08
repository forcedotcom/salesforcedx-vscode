/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import assert from 'node:assert/strict';
import { executeAnonymous } from '@salesforce/apex-node/effect';
import * as Effect from 'effect/Effect';

assert.equal(process.version, 'v22.19.0');
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
console.log('PASS native Node 22.19.0 V4 ESM operation');
