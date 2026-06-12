/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { SyncState } from '../tree/orgBrowserNode';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { StatusOutputRow } from '@salesforce/source-tracking';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Ref from 'effect/Ref';

type IndexedTrackingData = {
  byTypeAndName: Map<string, Map<string, StatusOutputRow>>;
  allRows: StatusOutputRow[];
};

const emptyIndex: IndexedTrackingData = { byTypeAndName: new Map(), allRows: [] };

const indexStatus = (rows: StatusOutputRow[]): IndexedTrackingData => {
  const byTypeAndName = new Map<string, Map<string, StatusOutputRow>>();
  rows.forEach(row => {
    const existing = byTypeAndName.get(row.type);
    const typeMap = existing ?? new Map<string, StatusOutputRow>();
    if (!existing) byTypeAndName.set(row.type, typeMap);
    typeMap.set(row.fullName, row);
  });
  return { byTypeAndName, allRows: rows };
};

const dedupeRows = (status: StatusOutputRow[]): StatusOutputRow[] => {
  const seen = new Set<string>();
  return status
    .filter(row => !row.ignored)
    .toSorted((a, b) => (b.conflict ? 1 : 0) - (a.conflict ? 1 : 0))
    .filter(row => {
      const key = `${row.fullName}:${row.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const rowToSyncState = (row: StatusOutputRow): SyncState => {
  if (row.conflict) return 'conflict';
  if (row.origin === 'remote') {
    if (row.state === 'delete') return 'remoteDeleted';
    if (row.state === 'add') return 'remoteAdded';
    return 'remoteModified';
  }
  if (row.state === 'delete') return 'localDeleted';
  if (row.state === 'add') return 'localAdded';
  return 'localModified';
};

const load = Effect.fn('SourceTrackingCacheService.load')(function* (
  dataRef: Ref.Ref<Option.Option<IndexedTrackingData>>,
  sem: Effect.Semaphore
) {
  // Fast path: if already loaded, return without acquiring semaphore
  const fast = yield* Ref.get(dataRef);
  if (Option.isSome(fast)) return fast.value;

  // Serialize the actual fetch so only one caller does the work
  return yield* sem.withPermits(1)(
    Effect.gen(function* () {
      // Double-check after acquiring — another caller may have populated it
      const current = yield* Ref.get(dataRef);
      if (Option.isSome(current)) return current.value;

      const svcApi = yield* (yield* ExtensionProviderService).getServicesApi;
      const sourceTrackingService = yield* svcApi.services.SourceTrackingService;
      const hasTrackingEnabled = yield* sourceTrackingService.hasTracking();
      if (!hasTrackingEnabled) {
        yield* Ref.set(dataRef, Option.some(emptyIndex));
        return emptyIndex;
      }

      const status = yield* sourceTrackingService.getStatus({ local: true, remote: true });
      const indexed = indexStatus(dedupeRows(status));
      yield* Ref.set(dataRef, Option.some(indexed));
      return indexed;
    })
  );
});

export class SourceTrackingCacheService extends Effect.Service<SourceTrackingCacheService>()(
  'SourceTrackingCacheService',
  {
    accessors: true,
    effect: Effect.gen(function* () {
      const dataRef = yield* Ref.make<Option.Option<IndexedTrackingData>>(Option.none());
      const loadSemaphore = yield* Effect.makeSemaphore(1);

      return {
        getSyncStateForComponent: Effect.fn('SourceTrackingCacheService.getSyncStateForComponent')(function* (
          type: string,
          fullName: string,
          filePresent: boolean
        ) {
          const data = yield* load(dataRef, loadSemaphore);
          const row = data.byTypeAndName.get(type)?.get(fullName);
          if (row) return rowToSyncState(row);
          return filePresent ? ('synced' as const satisfies SyncState) : ('notPresent' as const satisfies SyncState);
        }),

        getChangeCountsForType: Effect.fn('SourceTrackingCacheService.getChangeCountsForType')(function* (
          type: string
        ) {
          const data = yield* load(dataRef, loadSemaphore);
          const typeMap = data.byTypeAndName.get(type);
          if (!typeMap || typeMap.size === 0) return undefined;
          const counts = { local: 0, remote: 0, conflicts: 0 };
          typeMap.forEach(row => {
            if (row.conflict) counts.conflicts++;
            else if (row.origin === 'local') counts.local++;
            else counts.remote++;
          });
          return counts;
        }),

        getAllChanges: Effect.fn('SourceTrackingCacheService.getAllChanges')(function* () {
          const data = yield* load(dataRef, loadSemaphore);
          return data.allRows;
        }),

        hasTracking: Effect.fn('SourceTrackingCacheService.hasTracking')(function* () {
          const svcApi = yield* (yield* ExtensionProviderService).getServicesApi;
          return yield* svcApi.services.SourceTrackingService.hasTracking();
        }),

        invalidate: Ref.set(dataRef, Option.none())
      };
    })
  }
) {}
