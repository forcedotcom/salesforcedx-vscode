/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Cause from 'effect/Cause';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import { fromAnonymousPromise } from '../../../src/core/executeAnonymousCompat';

it.each(['throw', 'reject'])('retains opaque defect identity when a foreign callback fails by %s', async mode => {
  const defect = new Error('foreign callback defect');
  const exit = await Effect.runPromiseExit(
    fromAnonymousPromise(() => {
      if (mode === 'throw') throw defect;
      return Promise.reject(defect);
    })
  );

  expect(Exit.isFailure(exit)).toBe(true);
  if (Exit.isFailure(exit)) expect(Chunk.toReadonlyArray(Cause.defects(exit.cause))).toEqual([defect]);
  if (Exit.isFailure(exit)) expect(Chunk.toReadonlyArray(Cause.defects(exit.cause))[0]).toBe(defect);
});
