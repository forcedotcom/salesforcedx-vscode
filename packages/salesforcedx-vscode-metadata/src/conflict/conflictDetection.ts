/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DiffFilePair } from '../shared/diff/diffTypes';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import { isString } from 'effect/Predicate';
import * as Stream from 'effect/Stream';
import { URI } from 'vscode-uri';
import { filesAreNotIdentical, matchUrisToComponents, retrieveToCacheDirectory } from '../shared/diff/diffHelpers';
import { ConflictDetectionFailedError } from './conflictErrors';

/** Convert file paths to HashableUri set */
const pathsToHashableUris = Effect.fn('pathsToHashableUris')(function* (paths: string[]) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const fsService = yield* api.services.FsService;
  return HashSet.fromIterable(paths.map(p => fsService.HashableUri.fromUri(URI.file(p))));
});

/**
 * Detect conflicts for tracking orgs: get conflicts from SourceTracking,
 * retrieve remote content, return DiffFilePair[] for files that differ.
 */
export const detectConflictsFromTracking = Effect.fn('detectConflictsFromTracking')(function* () {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const [sourceTrackingService, componentSetService] = yield* Effect.all(
    [api.services.SourceTrackingService, api.services.ComponentSetService],
    { concurrency: 'unbounded' }
  );

  const tracking = yield* sourceTrackingService.getSourceTrackingOrThrow();

  const conflicts = yield* Effect.tryPromise({
    try: () => tracking.getConflicts(),
    catch: e =>
      new ConflictDetectionFailedError({
        message: e instanceof Error ? e.message : String(e),
        cause: e
      })
  });

  const filePaths = conflicts.flatMap(c => c.filenames ?? []).filter(isString);

  if (filePaths.length === 0) {
    return [] satisfies DiffFilePair[];
  }

  const componentSet = yield* componentSetService.ensureNonEmptyComponentSet(
    yield* componentSetService.getComponentSetFromUris(filePaths.map(p => URI.file(p)))
  );

  const retrieveResult = yield* retrieveToCacheDirectory(componentSet);
  if (!retrieveResult) {
    return [] satisfies DiffFilePair[];
  }

  const hashableUris = yield* pathsToHashableUris(filePaths);
  const retrievedComponents = retrieveResult.components.getSourceComponents().toArray();
  const pairsSet = yield* matchUrisToComponents(hashableUris, retrievedComponents);

  const differing = yield* pairsSet.pipe(
    Stream.fromIterable,
    Stream.filterEffect(filesAreNotIdentical),
    Stream.runCollect
  );

  return Chunk.toArray(differing);
});
