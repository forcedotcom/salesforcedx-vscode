/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as Cause from 'effect/Cause';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Fiber from 'effect/Fiber';
import { executeAnonymous, fromAnonymousPromise } from './executeAnonymousCompat.mjs';
import {
  connection,
  soapResponse,
  mixedExit,
  failures,
  defect,
  finalizerDefect,
  cancelWithFinalizers
} from '../apexV4/runtime.mjs';

const require = createRequire(import.meta.url);
const apexRequire = createRequire(require.resolve('@salesforce/apex-node/effect'));
assert.equal(require('effect/package.json').version, '3.22.2');
assert.equal(apexRequire('effect/package.json').version, '4.0.6');
assert.notEqual(require.resolve('effect/Effect'), apexRequire.resolve('effect/Effect'));
for (const logBody of [undefined, '', 'LOG']) {
  assert.deepEqual(
    await Effect.runPromise(executeAnonymous(connection(soapResponse({}, logBody)), { apexCode: 'code' })),
    {
      compiled: true,
      success: true,
      line: -1,
      column: -1,
      logBody
    }
  );
  const compile = await Effect.runPromise(
    Effect.flip(
      executeAnonymous(
        connection(
          soapResponse(
            {
              compiled: 'false',
              success: 'false',
              line: '3',
              compileProblem: { $: { 'xsi:nil': 'true' } }
            },
            logBody
          )
        ),
        { apexCode: 'bad' }
      )
    )
  );
  assert.equal(compile._tag, 'ApexCompileError');
  assert.equal(compile.compileProblem, null);
  assert.equal(compile.logBody, logBody);
  assert.equal(Effect.isEffect(compile), true);
}

const mixed = await Effect.runPromiseExit(fromAnonymousPromise(async () => mixedExit));
assert.equal(mixed._tag, 'Failure');
assert.deepEqual(
  Chunk.toReadonlyArray(Cause.failures(mixed.cause)).map(error => error._tag),
  failures.map(error => error._tag)
);
assert.equal(Chunk.toReadonlyArray(Cause.defects(mixed.cause))[0], defect);
assert.equal(Cause.isInterrupted(mixed.cause), true);
for (const error of Cause.failures(mixed.cause)) assert.equal(Effect.isEffect(error), true);

const malformed = await Effect.runPromiseExit(
  fromAnonymousPromise(async () => ({
    _tag: 'Failure',
    reasons: [{ _tag: 'Fail', error: {} }, ...mixedExit.reasons]
  }))
);
assert.equal(malformed._tag, 'Failure');
assert.equal(Chunk.toReadonlyArray(Cause.failures(malformed.cause)).length, 4);
assert.equal(Chunk.toReadonlyArray(Cause.defects(malformed.cause)).at(-1), defect);
for (const run of [
  () => {
    throw defect;
  },
  () => Promise.reject(defect)
]) {
  const exit = await Effect.runPromiseExit(fromAnonymousPromise(run));
  assert.equal(exit._tag, 'Failure');
  assert.equal(Chunk.toReadonlyArray(Cause.defects(exit.cause))[0], defect);
}

const started = Promise.withResolvers();
const finalizerStarted = Promise.withResolvers();
const finalizer = Promise.withResolvers();
const operation = Effect.runFork(
  fromAnonymousPromise(signal =>
    cancelWithFinalizers(signal, started.resolve, finalizerStarted.resolve, finalizer.promise)
  )
);
await started.promise;
let finished = false;
const interrupted = Effect.runPromise(Fiber.interrupt(operation)).then(exit => {
  finished = true;
  return exit;
});
await finalizerStarted.promise;
assert.equal(finished, false, 'V3 interruption must wait for V4 finalizers');
finalizer.resolve();
const exit = await interrupted;
assert.equal(Exit.isFailure(exit), true);
assert.equal(Cause.isInterrupted(exit.cause), true);
assert.deepEqual(Chunk.toReadonlyArray(Cause.defects(exit.cause)), [finalizerDefect, defect]);
console.log(
  'PASS actual V3 services adapter: null diagnostics, logs, four tagged failures, mixed reasons, defect identity, cancellation/finalizer wait'
);
