/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DiffFilePair } from '../shared/diff/diffTypes';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as HashSet from 'effect/HashSet';
import { isString } from 'effect/Predicate';
import * as Stream from 'effect/Stream';
import { filesAreNotIdentical, materializeRemoteComponents } from '../shared/diff/diffHelpers';

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
  const sourceTracking = yield* api.v2.services.SourceTrackingService;
  const componentSetService = yield* api.v2.services.ComponentSetService;
  const fsService = yield* api.v2.services.FsService;
  const HashableUri = fsService.HashableUri;

  const uris = yield* sourceTracking.getStatus({ local: true, remote: true }).pipe(
    Stream.fromIterableEffect,
    Stream.filter(
      c =>
        Boolean(c.conflict) &&
        (!componentSet ||
          (isString(c.type) && isString(c.fullName) && componentSet.has({ type: c.type, fullName: c.fullName })))
    ),
    Stream.map(c => (c.filePath ? [c.filePath] : [])),
    Stream.flattenIterable,
    Stream.filter(isString),
    Stream.mapEffect(p => api.v2.services.FsService.use(service => service.toUri(p))),
    Stream.runCollect
  );
  if (uris.length === 0) return [] satisfies DiffFilePair[];

  const localComponentSet = yield* componentSetService
    .getComponentSetFromUris(uris)
    .pipe(Effect.flatMap(componentSetService.ensureNonEmptyComponentSet));

  const localUriFilter = HashSet.fromIterable(uris.map(uri => HashableUri.fromUri(uri)));

  return yield* (yield* materializeRemoteComponents(localComponentSet, localUriFilter)).pipe(
    Stream.fromIterable,
    Stream.filterEffect(filesAreNotIdentical),
    Stream.runCollect
  );
});
