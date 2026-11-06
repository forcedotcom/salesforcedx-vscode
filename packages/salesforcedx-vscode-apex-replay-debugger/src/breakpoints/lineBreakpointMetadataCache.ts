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
import * as Fiber from 'effect/Fiber';
import type * as Scope from 'effect/Scope';

export type LineBreakpointMetadataCache = {
  readonly ensure: (uris: readonly string[]) => Effect.Effect<LineBreakpointInfo[], never>;
  readonly refresh: (uri: string) => Effect.Effect<LineBreakpointInfo[], never>;
  readonly snapshot: () => Effect.Effect<LineBreakpointInfo[], never>;
};

export const makeLineBreakpointMetadataCache = (
  getLineBreakpointInfo: (uri: string) => Promise<LineBreakpointInfo[]>,
  scope: Scope.Scope
): Effect.Effect<LineBreakpointMetadataCache, never> =>
  Effect.gen(function* () {
    const cache = yield* Cache.make({
      capacity: Number.MAX_SAFE_INTEGER,
      timeToLive: Duration.infinity,
      lookup: (uri: string) => Effect.promise(() => getLineBreakpointInfo(uri))
    });
    const refreshes = new Map<string, Fiber.Fiber<LineBreakpointInfo[], never>>();
    const initialReads = new Map<string, number>();
    const incrementInitialRead = (uri: string) => {
      initialReads.set(uri, (initialReads.get(uri) ?? 0) + 1);
    };
    const decrementInitialRead = (uri: string) => {
      const readers = initialReads.get(uri) ?? 0;
      if (readers <= 1) initialReads.delete(uri);
      else initialReads.set(uri, readers - 1);
    };
    const read = (uri: string) =>
      cache
        .get(uri)
        .pipe(Effect.catchAllCause(cause => cache.invalidate(uri).pipe(Effect.zipRight(Effect.failCause(cause)))));
    const get = (uri: string) =>
      Effect.suspend(() => {
        const activeRefresh = refreshes.get(uri);
        if (activeRefresh) return Fiber.join(activeRefresh);

        return Effect.sync(() => incrementInitialRead(uri)).pipe(
          Effect.zipRight(read(uri)),
          Effect.ensuring(Effect.sync(() => decrementInitialRead(uri)))
        );
      });
    const snapshot = (): Effect.Effect<LineBreakpointInfo[], never> =>
      cache.values.pipe(Effect.map(values => values.flat()));
    const refresh = (uri: string): Effect.Effect<LineBreakpointInfo[], never> =>
      Effect.suspend(() => {
        const activeRefresh = refreshes.get(uri);
        if (activeRefresh) return Fiber.join(activeRefresh);

        return Effect.gen(function* () {
          const registration: { fiber?: Fiber.Fiber<LineBreakpointInfo[], never> } = {};
          const refreshCache = initialReads.has(uri)
            ? read(uri).pipe(Effect.exit, Effect.zipRight(cache.invalidate(uri)), Effect.zipRight(read(uri)))
            : cache.refresh(uri).pipe(Effect.zipRight(read(uri)));
          const refreshEffect = refreshCache.pipe(
            Effect.catchAllCause(cause => cache.invalidate(uri).pipe(Effect.zipRight(Effect.failCause(cause)))),
            // The refresh owns its registration so an interrupted caller cannot expose stale cache data.
            Effect.ensuring(
              Effect.sync(() => {
                if (refreshes.get(uri) === registration.fiber) refreshes.delete(uri);
              })
            )
          );
          const refreshFiber = yield* Effect.forkIn(refreshEffect, scope);
          registration.fiber = refreshFiber;
          refreshes.set(uri, refreshFiber);
          return yield* Fiber.join(refreshFiber);
        });
      });

    return {
      ensure: uris =>
        Effect.forEach([...new Set(uris)], get, { concurrency: 'unbounded' }).pipe(
          Effect.map(results => results.flat())
        ),
      refresh,
      snapshot
    };
  });
