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

  const uris = yield* sourceTrackingService.getConflicts().pipe(
    Stream.fromIterableEffect,
    Stream.filter(
      c =>
        !componentSet || (isString(c.type) && isString(c.name) && componentSet.has({ type: c.type, fullName: c.name }))
    ),
    Stream.mapConcat(c => c.filenames ?? []),
    Stream.filter(isString),
    Stream.mapEffect(p => api.services.FsService.toUri(p)),
    Stream.runCollect,
    Effect.map(Chunk.toArray)
  );
  if (uris.length === 0) return [] satisfies DiffFilePair[];

  const retrieveResult = yield* componentSetService
    .getComponentSetFromUris(uris)
    .pipe(Effect.flatMap(componentSetService.ensureNonEmptyComponentSet), Effect.flatMap(retrieveToCacheDirectory));

  if (!retrieveResult) return [] satisfies DiffFilePair[];

  const retrievedComponents = retrieveResult.components.getSourceComponents().toArray();

  return yield* (yield* matchUrisToComponents(
    HashSet.fromIterable(uris.map(uri => HashableUri.fromUri(uri))),
    retrievedComponents
  )).pipe(Stream.fromIterable, Stream.filterEffect(filesAreNotIdentical), Stream.runCollect, Effect.map(Chunk.toArray));
});
