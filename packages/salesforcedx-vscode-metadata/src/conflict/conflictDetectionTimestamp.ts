/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DiffFilePair } from '../shared/diff/diffTypes';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as Chunk from 'effect/Chunk';
import * as DateTime from 'effect/DateTime';
import * as Effect from 'effect/Effect';
import { isNotUndefined } from 'effect/Predicate';
import * as Stream from 'effect/Stream';
import { filesAreNotIdentical, materializeRemoteComponents } from '../shared/diff/diffHelpers';
import { buildTimestampIndex } from './resultStorage';

const componentKey = (type: string, fullName: string) => `${type}:${fullName}`;

const dateIsNewer = (remote: string, stored: DateTime.Utc) =>
  new Date(remote).getTime() > DateTime.toEpochMillis(stored);

const computePotentialConflictKeys = Effect.fn('conflictDetection.computePotentialConflictKeys')(function* (
  entries: readonly {
    readonly reference: { readonly xmlName?: string; readonly fullName?: string };
    readonly lastModifiedDate?: string;
  }[]
) {
  const timestampIndex = yield* buildTimestampIndex();
  return entries.reduce<Set<string>>((acc, entry) => {
    if (!entry.reference.xmlName || !entry.reference.fullName) return acc;
    const key = componentKey(entry.reference.xmlName, entry.reference.fullName);
    const stored = timestampIndex.get(key);
    if (!entry.lastModifiedDate) return acc;
    const isConflict = !stored || dateIsNewer(entry.lastModifiedDate, stored);
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
  const projectComponents = componentSet.getSourceComponents().toArray();

  if (projectComponents.length === 0) {
    return [] satisfies DiffFilePair[];
  }

  if (operationType === 'retrieve') {
    const retrievePairs = yield* materializeRemoteComponents(componentSet, undefined, undefined, 'refresh');
    return yield* retrievePairs.pipe(
      Stream.fromIterable,
      Stream.filterEffect(filesAreNotIdentical),
      Stream.runCollect,
      Effect.map(Chunk.toArray)
    );
  }

  yield* Effect.forEach(
    [...new Set(projectComponents.map(component => component.type.name))],
    xmlName => api.services.OrgMetadataCatalog.refreshMetadataComponents({ xmlName }),
    { concurrency: 1, discard: true }
  );
  const entries = (yield* Effect.forEach(
    projectComponents,
    component =>
      api.services.OrgMetadataCatalog.getEntry({
        xmlName: component.type.name,
        fullName: component.fullName
      }),
    { concurrency: 'unbounded' }
  )).filter(isNotUndefined);
  const potentialConflictKeys = yield* computePotentialConflictKeys(entries);

  if (potentialConflictKeys.size === 0) return [] satisfies DiffFilePair[];

  const deployPairs = yield* materializeRemoteComponents(
    componentSet,
    undefined,
    component => potentialConflictKeys.has(componentKey(component.type.name, component.fullName)),
    'refresh'
  );

  // materializeRemoteComponents already received the potential-conflict component
  // predicate. Avoid filtering the resulting URIs again as plain strings: Windows
  // paths are case-insensitive and may arrive with different segment casing.
  const deployDiffering = yield* deployPairs.pipe(
    Stream.fromIterable,
    Stream.filterEffect(filesAreNotIdentical),
    Stream.runCollect
  );

  return Chunk.toArray(deployDiffering);
});
