/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { LineBreakpointInfo } from '@salesforce/salesforcedx-utils';
import * as Cache from 'effect/Cache';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';

export type LineBreakpointMetadataCache = {
  readonly ensure: (uris: readonly string[]) => Effect.Effect<LineBreakpointInfo[], never>;
  readonly refresh: (uri: string) => Effect.Effect<LineBreakpointInfo[], never>;
  readonly snapshot: () => Effect.Effect<LineBreakpointInfo[], never>;
};

export const makeLineBreakpointMetadataCache = (
  getLineBreakpointInfo: (uri: string) => Promise<LineBreakpointInfo[]>
): Effect.Effect<LineBreakpointMetadataCache, never> =>
  Effect.gen(function* () {
    const cache = yield* Cache.make({
      capacity: Number.MAX_SAFE_INTEGER,
      timeToLive: Duration.infinity,
      lookup: (uri: string) => Effect.promise(() => getLineBreakpointInfo(uri))
    });
    const snapshot = (): Effect.Effect<LineBreakpointInfo[], never> =>
      cache.values.pipe(Effect.map(values => values.flat()));
    const refresh = (uri: string): Effect.Effect<LineBreakpointInfo[], never> =>
      cache.invalidate(uri).pipe(Effect.flatMap(() => cache.get(uri)));

    return {
      ensure: uris =>
        Effect.forEach([...new Set(uris)], uri => cache.get(uri), { concurrency: 'unbounded' }).pipe(
          Effect.map(results => results.flat())
        ),
      refresh,
      snapshot
    };
  });
