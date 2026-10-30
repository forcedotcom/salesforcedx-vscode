/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ExecuteService, TestService, MarkdownTextFormatTransformer } from '@salesforce/apex-node';
import {
  executeAnonymous,
  ApexCompileError,
  ApexOperationError,
  ApexResponseDecodeError,
  ApexRuntimeError
} from '@salesforce/apex-node/effect';
import { executeAnonymousExit } from '@salesforce/apex-node/execute-anonymous-compat';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
// Test the package-owned encoder directly, not a fixture copy. This is not a supported deep export.
import { encodeAnonymousExit } from './node_modules/@salesforce/apex-node/out/src/effect/executeAnonymousExit.js';

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

export const failures = [
  new ApexOperationError({ operation: 'executeAnonymous', message: 'operation', cause: 'request' }),
  new ApexResponseDecodeError({ operation: 'executeAnonymous', message: 'decode', cause: 'response' }),
  new ApexCompileError({
    operation: 'executeAnonymous',
    message: 'compile',
    line: 2,
    column: 3,
    compileProblem: null,
    logBody: ''
  }),
  new ApexRuntimeError({
    operation: 'executeAnonymous',
    message: 'runtime',
    line: 4,
    column: 5,
    exceptionMessage: null,
    exceptionStackTrace: '',
    logBody: 'LOG'
  })
];
export const defect = new Error('opaque defect');
export const finalizerDefect = new Error('finalizer failed');
export const mixedExit = encodeAnonymousExit(
  Exit.failCause(
    Cause.fromReasons([
      ...failures.map(Cause.makeFailReason),
      Cause.makeDieReason(defect),
      Cause.makeInterruptReason(42)
    ])
  )
);
assert.equal(mixedExit._tag, 'Failure');
assert.equal(mixedExit.reasons.length, 6);
assert.equal(mixedExit.reasons[4].defect, defect);
assert.deepEqual(
  mixedExit.reasons.slice(0, 4).map(reason => reason.error._tag),
  failures.map(failure => failure._tag)
);
for (const reason of mixedExit.reasons.slice(0, 4)) {
  assert.equal(Object.getPrototypeOf(reason.error), Object.prototype);
  assert.equal(Effect.isEffect(reason.error), false);
}

export const cancelWithFinalizers = (signal, started, finalizerStarted, releaseFinalizer) =>
  Effect.scoped(
    Effect.addFinalizer(() =>
      Effect.promise(async () => {
        finalizerStarted();
        await releaseFinalizer;
      }).pipe(
        // Finalizers have no typed error channel; their failures are defects in V4.
        Effect.andThen(Effect.failCause(Cause.combine(Cause.die(finalizerDefect), Cause.die(defect))))
      )
    ).pipe(Effect.andThen(Effect.sync(started)), Effect.andThen(Effect.never))
  ).pipe(
    program => Effect.runPromiseExit(program, { signal }),
    completion => completion.then(encodeAnonymousExit)
  );

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
  assert.deepEqual(await executeAnonymousExit(conn, { apexCode: 'code' }, new AbortController().signal), {
    _tag: 'Success',
    value: { compiled: true, success: true, line: -1, column: -1, logBody }
  });
}
let requests = 0;
const controller = new AbortController();
controller.abort();
assert.deepEqual(
  await executeAnonymousExit(
    {
      request: () => {
        requests++;
      }
    },
    { apexCode: 'code' },
    controller.signal
  ),
  {
    _tag: 'Failure',
    reasons: [{ _tag: 'Interrupt', fiberId: undefined }]
  }
);
assert.equal(requests, 0);
console.log('PASS packed native Apex CJS/ESM root, V4 operation, Promise results, encoded failures and pre-abort');
