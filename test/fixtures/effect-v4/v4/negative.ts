/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';

// Deliberate bad inputs: prove V4 is analyzed, not silently skipped.
Effect.succeed('floating');
export const unknownError: Effect.Effect<string, unknown> = Effect.succeed('unknown');
export const leakedError = Effect.gen(function* () {
  return yield* unknownError;
});
export const unknownRequirements: Effect.Effect<string, never, unknown> = Effect.succeed('requirements');
export const leakedRequirements = Effect.gen(function* () {
  return yield* unknownRequirements;
});
export const nestedRunner = Effect.gen(function* () {
  return Effect.runSync(Effect.succeed('nested'));
});
