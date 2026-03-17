/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DiffFilePair } from '../shared/diff/diffTypes';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ComponentSet, SourceComponent } from '@salesforce/source-deploy-retrieve';
import * as Chunk from 'effect/Chunk';
import * as DateTime from 'effect/DateTime';
import * as Effect from 'effect/Effect';
import { isString } from 'effect/Predicate';
import * as Stream from 'effect/Stream';
import {
  filesAreNotIdentical,
  matchUrisToComponents,
  pathsToHashableUris,
  retrieveToCacheDirectory
} from '../shared/diff/diffHelpers';
import { buildTimestampIndex } from './resultStorage';

const componentKey = (type: string, fullName: string) => `${type}:${fullName}`;

const dateIsNewer = (remote: string, stored: DateTime.Utc) =>
  new Date(remote).getTime() > DateTime.toEpochMillis(stored);

type FileProperty = { type: string; fullName: string; lastModifiedDate?: string };

const computePotentialConflictKeys = Effect.fn('conflictDetection.computePotentialConflictKeys')(function* (
  fileProperties: FileProperty[]
) {
  const timestampIndex = yield* buildTimestampIndex();
  return fileProperties.reduce<Set<string>>((acc, fp) => {
    const key = componentKey(fp.type, fp.fullName);
    const stored = timestampIndex.get(key);
    const remoteDate = fp.lastModifiedDate;
    if (!remoteDate) return acc;
    const isConflict = !stored || dateIsNewer(remoteDate, stored);
    if (isConflict) acc.add(key);
    return acc;
  }, new Set());
});

/** Get local file paths from componentSet source components */
const getLocalPathsFromComponentSet = (componentSet: ComponentSet): string[] =>
  Array.from(
    new Set<string>(
      componentSet
        .getSourceComponents()
        .toArray()
        .flatMap((c: SourceComponent) => [c.content, c.xml, ...(c.walkContent?.() ?? [])])
        .filter(isString)
    )
  );

/**
 * Detect conflicts for non-tracking orgs using timestamps.
 * Deploy: "has the server copy changed since I last deployed/retrieved?"
 * Retrieve: "do I have local changes that would be lost?"
 */
export const detectConflictsFromTimestamps = Effect.fn('detectConflictsFromTimestamps')(function* (
  componentSet: ComponentSet,
  operationType: 'deploy' | 'retrieve'
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const componentSetService = yield* api.services.ComponentSetService;
  const nonEmpty = yield* componentSetService.ensureNonEmptyComponentSet(componentSet);

  const retrieveResult = yield* retrieveToCacheDirectory(nonEmpty);
  if (!retrieveResult) {
    return [] satisfies DiffFilePair[];
  }

  const retrievedComponents = retrieveResult.components.getSourceComponents().toArray();
  const localPaths = getLocalPathsFromComponentSet(componentSet);
  if (localPaths.length === 0) {
    return [] satisfies DiffFilePair[];
  }

  const hashableUris = yield* pathsToHashableUris(localPaths);
  const pairsSet = yield* matchUrisToComponents(hashableUris, retrievedComponents);

  if (operationType === 'retrieve') {
    return yield* pairsSet.pipe(
      Stream.fromIterable,
      Stream.filterEffect(filesAreNotIdentical),
      Stream.runCollect,
      Effect.map(Chunk.toArray)
    );
  }

  const potentialConflictKeys = yield* computePotentialConflictKeys(
    Array.isArray(retrieveResult.response.fileProperties)
      ? retrieveResult.response.fileProperties
      : [retrieveResult.response.fileProperties]
  );

  if (potentialConflictKeys.size === 0) return [] satisfies DiffFilePair[];

  const conflictLocalPaths = [
    ...new Set(
      componentSet
        .getSourceComponents()
        .toArray()
        .filter(c => potentialConflictKeys.has(componentKey(c.type.name, c.fullName)))
        .flatMap(c => [c.content, c.xml, ...(c.walkContent?.() ?? [])])
        .filter(isString)
    )
  ];

  if (conflictLocalPaths.length === 0) return [] satisfies DiffFilePair[];

  const conflictUris = yield* pathsToHashableUris(conflictLocalPaths);
  const conflictPairs = yield* matchUrisToComponents(conflictUris, retrievedComponents);
  const deployDiffering = yield* conflictPairs.pipe(
    Stream.fromIterable,
    Stream.filterEffect(filesAreNotIdentical),
    Stream.runCollect
  );

  return Chunk.toArray(deployDiffering);
});
