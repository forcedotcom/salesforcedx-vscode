/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DiffFilePair } from '../shared/diff/diffTypes';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import { isString } from 'effect/Predicate';
import * as Stream from 'effect/Stream';
import { filesAreNotIdentical, matchUrisToComponents, retrieveToCacheDirectory } from '../shared/diff/diffHelpers';
import { ConflictDetectionFailedError } from './conflictErrors';

/**
 * Detect conflicts for tracking orgs: get conflicts from SourceTracking,
 * filter to componentSet when provided (type+fullName), retrieve remote content,
 * return DiffFilePair[] for files that differ.
 * When componentSet is omitted (e.g. status bar "show all"), uses all conflicts.
 */
export const detectConflictsFromTracking = Effect.fn('detectConflictsFromTracking')(function* (
  componentSet?: ComponentSet
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [sourceTrackingService, componentSetService, HashableUri] = yield* Effect.all(
    [api.services.SourceTrackingService, api.services.ComponentSetService, api.services.FsService.HashableUri],
    { concurrency: 'unbounded' }
  );

  const tracking = yield* sourceTrackingService.getSourceTrackingOrThrow();

  const allConflicts = yield* Effect.tryPromise({
    try: () => tracking.getConflicts(),
    catch: e =>
      new ConflictDetectionFailedError({
        message: e instanceof Error ? e.message : String(e),
        cause: e
      })
  });

  const componentMembers = componentSet
    ? new Set(
        componentSet
          .getSourceComponents()
          .toArray()
          .map(c => `${c.type.name}:${c.fullName}`)
      )
    : null;

  const uris = yield* Stream.fromIterable(allConflicts).pipe(
    Stream.filter(c =>
      componentMembers ? isString(c.type) && isString(c.name) && componentMembers.has(`${c.type}:${c.name}`) : true
    ),
    Stream.mapConcat(c => c.filenames ?? []),
    Stream.filter(isString),
    Stream.mapEffect(p => api.services.FsService.toUri(p)),
    Stream.runCollect,
    Effect.map(Chunk.toArray)
  );
  if (uris.length === 0) return [] satisfies DiffFilePair[];

  const filteredComponentSet = yield* componentSetService.ensureNonEmptyComponentSet(
    yield* componentSetService.getComponentSetFromUris(uris)
  );

  const retrieveResult = yield* retrieveToCacheDirectory(filteredComponentSet);
  if (!retrieveResult) return [] satisfies DiffFilePair[];

  const retrievedComponents = retrieveResult.components.getSourceComponents().toArray();

  return yield* (yield* matchUrisToComponents(
    HashSet.fromIterable(uris.map(uri => HashableUri.fromUri(uri))),
    retrievedComponents
  )).pipe(Stream.fromIterable, Stream.filterEffect(filesAreNotIdentical), Stream.runCollect, Effect.map(Chunk.toArray));
});
