/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';

export const releaseAll = <E>(releases: readonly Effect.Effect<unknown, E>[]) =>
  Effect.all(releases.map(Effect.uninterruptible), { concurrency: 'unbounded', mode: 'validate', discard: true }).pipe(
    Effect.parallelErrors
  );
