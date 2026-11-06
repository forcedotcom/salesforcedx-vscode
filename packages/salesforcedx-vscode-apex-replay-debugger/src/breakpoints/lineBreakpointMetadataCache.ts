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
import * as HashMap from 'effect/HashMap';
import * as HashSet from 'effect/HashSet';
import * as Option from 'effect/Option';
import type * as Scope from 'effect/Scope';
import type { HashableUri } from 'salesforcedx-vscode-services';

export type LineBreakpointMetadataCache = {
  readonly ensure: (uris: readonly HashableUri[]) => Effect.Effect<LineBreakpointInfo[], never>;
  readonly refresh: (uri: HashableUri) => Effect.Effect<LineBreakpointInfo[], never>;
  readonly snapshot: () => Effect.Effect<LineBreakpointInfo[], never>;
};

export const makeLineBreakpointMetadataCache = (
  getLineBreakpointInfo: (uri: HashableUri) => Promise<LineBreakpointInfo[]>,
  scope: Scope.Scope
): Effect.Effect<LineBreakpointMetadataCache, never> =>
  Effect.gen(function* () {
    const cache = yield* Cache.make<HashableUri, LineBreakpointInfo[]>({
      capacity: Number.MAX_SAFE_INTEGER,
      timeToLive: Duration.infinity,
      lookup: uri => Effect.promise(() => getLineBreakpointInfo(uri))
    });
    let refreshes = HashMap.empty<HashableUri, Fiber.Fiber<LineBreakpointInfo[], never>>();
    let initialReads = HashMap.empty<HashableUri, number>();
    const incrementInitialRead = (uri: HashableUri) => {
      initialReads = HashMap.set(initialReads, uri, (Option.getOrUndefined(HashMap.get(initialReads, uri)) ?? 0) + 1);
    };
    const decrementInitialRead = (uri: HashableUri) => {
      const readers = Option.getOrUndefined(HashMap.get(initialReads, uri)) ?? 0;
      initialReads = readers <= 1 ? HashMap.remove(initialReads, uri) : HashMap.set(initialReads, uri, readers - 1);
    };
    const read = (uri: HashableUri) =>
      cache.get(uri).pipe(
        Effect.catchAllCause(cause => cache.invalidate(uri).pipe(Effect.zipRight(Effect.failCause(cause)))),
        Effect.map(lineBreakpointInfo => lineBreakpointInfo.map(info => ({ ...info, uri: uri.uri.toString() })))
      );
    const get = (uri: HashableUri) =>
      Effect.suspend(() => {
        const activeRefresh = Option.getOrUndefined(HashMap.get(refreshes, uri));
        if (activeRefresh !== undefined) {
          return Fiber.join(activeRefresh).pipe(
            Effect.map(lineBreakpointInfo => lineBreakpointInfo.map(info => ({ ...info, uri: uri.uri.toString() })))
          );
        }

        return Effect.sync(() => incrementInitialRead(uri)).pipe(
          Effect.zipRight(read(uri)),
          Effect.ensuring(Effect.sync(() => decrementInitialRead(uri)))
        );
      });
    const snapshot = (): Effect.Effect<LineBreakpointInfo[], never> =>
      cache.values.pipe(Effect.map(values => values.flat()));
    const refresh = (uri: HashableUri): Effect.Effect<LineBreakpointInfo[], never> =>
      Effect.suspend(() => {
        const activeRefresh = Option.getOrUndefined(HashMap.get(refreshes, uri));
        if (activeRefresh !== undefined) return Fiber.join(activeRefresh);

        return Effect.gen(function* () {
          const registration: { fiber?: Fiber.Fiber<LineBreakpointInfo[], never> } = {};
          const refreshCache = HashMap.has(initialReads, uri)
            ? read(uri).pipe(Effect.exit, Effect.zipRight(cache.invalidate(uri)), Effect.zipRight(read(uri)))
            : cache.refresh(uri).pipe(Effect.zipRight(read(uri)));
          const refreshEffect = refreshCache.pipe(
            Effect.catchAllCause(cause => cache.invalidate(uri).pipe(Effect.zipRight(Effect.failCause(cause)))),
            // The refresh owns its registration so an interrupted caller cannot expose stale cache data.
            Effect.ensuring(
              Effect.sync(() => {
                if (Option.getOrUndefined(HashMap.get(refreshes, uri)) === registration.fiber) {
                  refreshes = HashMap.remove(refreshes, uri);
                }
              })
            )
          );
          const refreshFiber = yield* Effect.forkIn(refreshEffect, scope);
          registration.fiber = refreshFiber;
          refreshes = HashMap.set(refreshes, uri, refreshFiber);
          return yield* Fiber.join(refreshFiber).pipe(
            Effect.map(lineBreakpointInfo => lineBreakpointInfo.map(info => ({ ...info, uri: uri.uri.toString() })))
          );
        });
      });

    return {
      ensure: uris =>
        Effect.forEach(HashSet.fromIterable(uris), get, { concurrency: 'unbounded' }).pipe(
          Effect.map(results => results.flat())
        ),
      refresh,
      snapshot
    };
  });
