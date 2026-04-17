/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DiffFilePair } from '../shared/diff/diffTypes';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ComponentSet, FileProperties } from '@salesforce/source-deploy-retrieve';
import * as Chunk from 'effect/Chunk';
import * as DateTime from 'effect/DateTime';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import * as Stream from 'effect/Stream';
import { URI } from 'vscode-uri';
import {
  filesAreNotIdentical,
  matchUrisToComponents,
  retrieveToCacheDirectory,
  sourceComponentToPaths
} from '../shared/diff/diffHelpers';
import { buildTimestampIndex } from './resultStorage';
import { getFileProperties } from './shared';

const componentKey = (type: string, fullName: string) => `${type}:${fullName}`;

const dateIsNewer = (remote: string, stored: DateTime.Utc) =>
  new Date(remote).getTime() > DateTime.toEpochMillis(stored);

const computePotentialConflictKeys = Effect.fn('conflictDetection.computePotentialConflictKeys')(function* (
  fileProperties: FileProperties[]
) {
  const timestampIndex = yield* buildTimestampIndex();
  return fileProperties.reduce<Set<string>>((acc, fp) => {
    const key = componentKey(fp.type, fp.fullName);
    const stored = timestampIndex.get(key);
    if (!fp.lastModifiedDate) return acc;
    const isConflict = !stored || dateIsNewer(fp.lastModifiedDate, stored);
    if (isConflict) acc.add(key);
    return acc;
  }, new Set());
});

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

  const projectComponents = componentSet.getSourceComponents().toArray();

  if (projectComponents.length === 0) {
    return [] satisfies DiffFilePair[];
  }

  const pairsSet = yield* matchUrisToComponents(componentSet, retrieveResult.components);

  if (operationType === 'retrieve') {
    return yield* pairsSet.pipe(
      Stream.fromIterable,
      Stream.filterEffect(filesAreNotIdentical),
      Stream.runCollect,
      Effect.map(Chunk.toArray)
    );
  }

  const potentialConflictKeys = yield* computePotentialConflictKeys(getFileProperties(retrieveResult));

  if (potentialConflictKeys.size === 0) return [] satisfies DiffFilePair[];

  const conflictingPaths = new Set(
    projectComponents
      .filter(c => potentialConflictKeys.has(componentKey(c.type.name, c.fullName)))
      .flatMap(sourceComponentToPaths)
      .map(p => URI.file(p).path)
  );

  if (conflictingPaths.size === 0) return [] satisfies DiffFilePair[];

  const conflictPairs = HashSet.filter(pairsSet, pair => conflictingPaths.has(pair.localUri.path));
  const deployDiffering = yield* conflictPairs.pipe(
    Stream.fromIterable,
    Stream.filterEffect(filesAreNotIdentical),
    Stream.runCollect
  );

  return Chunk.toArray(deployDiffering);
});
