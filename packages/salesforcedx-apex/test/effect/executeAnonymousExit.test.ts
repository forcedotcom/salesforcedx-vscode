/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import { ApexCompileError } from '../../src/effect/errors.js';
import { encodeAnonymousExit } from '../../src/effect/executeAnonymousExit.js';

it('copies every mixed reason and encodes typed failures without losing diagnostic or defect identity', () => {
  const defect = new Error('opaque defect');
  const failure = new ApexCompileError({
    operation: 'executeAnonymous',
    message: 'compile',
    line: 2,
    column: 3,
    compileProblem: null,
    logBody: ''
  });
  const encoded = encodeAnonymousExit(
    Exit.failCause(
      Cause.fromReasons([Cause.makeFailReason(failure), Cause.makeDieReason(defect), Cause.makeInterruptReason(42)])
    )
  );

  expect(encoded).toEqual({
    _tag: 'Failure',
    reasons: [
      {
        _tag: 'Fail',
        error: {
          _tag: 'ApexCompileError',
          operation: 'executeAnonymous',
          message: 'compile',
          line: 2,
          column: 3,
          compileProblem: null,
          logBody: ''
        }
      },
      { _tag: 'Die', defect },
      { _tag: 'Interrupt', fiberId: 42 }
    ]
  });
  if (encoded._tag === 'Failure' && encoded.reasons[0]._tag === 'Fail' && encoded.reasons[1]._tag === 'Die') {
    expect(encoded.reasons[0].error).not.toBe(failure);
    expect(Object.getPrototypeOf(encoded.reasons[0].error)).toBe(Object.prototype);
    expect(Effect.isEffect(encoded.reasons[0].error)).toBe(false);
    expect(encoded.reasons[1].defect).toBe(defect);
  }
});
