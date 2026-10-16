/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import {
  extractHeapDumpIdsFromLog,
  type ApexExecutionOverlayResultCommandSuccess,
  type HeapDumpResult
} from '@salesforce/salesforcedx-apex-replay-debugger';
import * as Arr from 'effect/Array';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import { isRecord, isString } from 'effect/Predicate';
import * as S from 'effect/Schema';
import * as Stream from 'effect/Stream';

// SOQL `IN` collections cap at 200 items; a single tooling query returns the full HeapDump
// compound field for each id — which /composite/batch does NOT (it returns only the sobject
// `attributes` stub, dropping HeapDump), so batching per-id GETs there yields empty overlays.
const MAX_QUERY_IDS = 200;
const QUERY_CONCURRENCY = 15;

const OverlayRow = S.Unknown.pipe(
  S.filter((value): value is ApexExecutionOverlayResultCommandSuccess => isRecord(value) && isString(value.Id))
);

/** Tooling query for a chunk of heap-dump ids, mapped to a HeapDumpResult per id (missing id → error). */
const runOverlayQuery = Effect.fn('heapDumpOverlayFetch.runOverlayQuery')(function* (ids: string[]) {
  return yield* Effect.flatMap(ExtensionProviderService, provider => provider.getServicesApi).pipe(
    Effect.flatMap(api => api.services.QueryService),
    Effect.flatMap(queryService =>
      queryService.query(
        {
          soql: `SELECT Id, HeapDump, ApexResult, SOQLResult, Line, Iteration, ClassName, Namespace, IsDumpingHeap, OverlayResultLength FROM ApexExecutionOverlayResult WHERE Id IN (${ids
            .map(id => `'${id}'`)
            .join(',')})`,
          tooling: true
        },
        OverlayRow
      )
    ),
    Effect.flatMap(({ records }) => Stream.runCollect(records)),
    Effect.map(chunk => new Map(Chunk.toReadonlyArray(chunk).map(record => [record.Id, record]))),
    Effect.map(byId =>
      ids.map((id): HeapDumpResult => {
        const record = byId.get(id);
        return record
          ? { heapDumpId: id, success: record }
          : { heapDumpId: id, error: `No overlay result found for ${id}` };
      })
    )
  );
});

/**
 * Extracts heap-dump ids from the log, dedups them, and fetches their overlay results via a
 * tooling SOQL query (200 ids per query, up to 15 queries in flight). A single query returns the
 * full HeapDump compound field per id; /composite/batch omits it, so a query is used instead.
 */
export const fetchHeapDumpOverlayResults = Effect.fn('heapDumpOverlayFetch.fetchHeapDumpOverlayResults')(function* (
  logFileContents: string
) {
  return yield* pipe(
    extractHeapDumpIdsFromLog(logFileContents.split(/\r?\n/)),
    Arr.map(entry => entry.heapDumpId),
    Arr.dedupe,
    Stream.fromIterable,
    Stream.grouped(MAX_QUERY_IDS),
    Stream.mapEffect(chunk => chunk.pipe(Chunk.toArray, runOverlayQuery), { concurrency: QUERY_CONCURRENCY }),
    Stream.flattenIterables,
    Stream.runCollect,
    Effect.map(Chunk.toArray)
  );
});
