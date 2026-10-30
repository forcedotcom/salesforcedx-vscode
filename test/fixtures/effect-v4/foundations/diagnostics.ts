/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';

Effect.succeed('V4 floating-effect control');
export const nestedRunner = Effect.gen(function* () {
  const value = Effect.runSync(Effect.succeed('V4 nested-runner control'));
  return yield* Effect.succeed(value);
});
