/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ExecuteService, TestService, MarkdownTextFormatTransformer } from '@salesforce/apex-node';
import { executeAnonymous } from '@salesforce/apex-node/effect';
import * as Effect from 'effect/Effect';

export const connection = response => ({
  accessToken: '00D000000000001!token',
  instanceUrl: 'https://example.my.salesforce.com',
  version: '67.0',
  request: async () => response
});
export const soapResponse = (fields = {}, logBody) => ({
  'soapenv:Envelope': {
    ...(logBody === undefined ? {} : { 'soapenv:Header': { DebuggingInfo: { debugLog: logBody } } }),
    'soapenv:Body': {
      executeAnonymousResponse: {
        result: {
          compiled: 'true',
          success: 'true',
          line: '-1',
          column: '-1',
          compileProblem: '',
          exceptionMessage: '',
          exceptionStackTrace: '',
          ...fields
        }
      }
    }
  }
});

const require = createRequire(import.meta.url);
assert.equal(require('@salesforce/apex-node').ExecuteService, ExecuteService);
assert.equal(new ExecuteService(connection({})).constructor.name, 'ExecuteService');
assert.equal(typeof TestService, 'function');
assert.equal(typeof MarkdownTextFormatTransformer, 'function');
for (const logBody of [undefined, '', 'LOG']) {
  const conn = connection(soapResponse({}, logBody));
  assert.deepEqual(await new ExecuteService(conn).executeAnonymous({ apexCode: 'code' }), {
    compiled: true,
    success: true,
    logs: logBody
  });
  assert.deepEqual(await Effect.runPromise(executeAnonymous(conn, { apexCode: 'code' })), {
    compiled: true,
    success: true,
    line: -1,
    column: -1,
    logBody
  });
}
console.log('PASS packed native Apex CJS/ESM root and V4 operation');
