/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import {
  extractHeapDumpIdsFromLog,
  type ApexExecutionOverlayResultCommandSuccess,
  type HeapDumpResult
} from '@salesforce/salesforcedx-apex-replay-debugger';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as S from 'effect/Schema';
import * as Stream from 'effect/Stream';

const OVERLAY_CLIENT_ID = 'sfdx-vscode';
const MAX_BATCH_SIZE = 25;
const BATCH_API_CONCURRENCY = 15;

type BatchError = { errorCode: string; message: string };
type BatchSubRequest = { method: string; url: string };
type BatchRequest = { batchRequests: BatchSubRequest[] };
type BatchSubResponse = { statusCode: number; result: ApexExecutionOverlayResultCommandSuccess | BatchError[] };
type BatchResponse = { hasErrors: boolean; results: BatchSubResponse[] };

class HeapDumpOverlayFetchError extends S.TaggedError<HeapDumpOverlayFetchError>()('HeapDumpOverlayFetchError', {
  cause: S.Unknown,
  message: S.String
}) {}

const isBatchError = (result: BatchSubResponse['result']): result is BatchError[] => Array.isArray(result);

const toResult = (heapDumpId: string, subResponse: BatchSubResponse): HeapDumpResult =>
  subResponse.statusCode >= 200 && subResponse.statusCode < 300 && !isBatchError(subResponse.result)
    ? { heapDumpId, success: subResponse.result }
    : {
        heapDumpId,
        error: isBatchError(subResponse.result)
          ? `${subResponse.result[0]?.message ?? 'Unknown error'} (${subResponse.result[0]?.errorCode ?? subResponse.statusCode})`
          : `HTTP ${subResponse.statusCode}`
      };

/** POST /composite/batch retrieving overlay results for a chunk of heap-dump ids (dynamic API version). */
const runOverlayBatch = Effect.fn('heapDumpOverlayFetch.runOverlayBatch')(function* (conn: Connection, ids: string[]) {
  const body: BatchRequest = {
    batchRequests: ids.map(id => ({
      method: 'GET',
      url: `v${conn.version}/tooling/sobjects/ApexExecutionOverlayResult/${id}`
    }))
  };
  const response = yield* Effect.tryPromise({
    try: () =>
      conn.request<BatchResponse>({
        method: 'POST',
        url: '/composite/batch',
        body: JSON.stringify(body),
        headers: {
          'User-Agent': 'salesforcedx-extension',
          'Sforce-Call-Options': `client=${OVERLAY_CLIENT_ID}`
        }
      }),
    catch: error =>
      new HeapDumpOverlayFetchError({
        cause: error,
        message: `Failed to fetch heap dump overlay results: ${error instanceof Error ? error.message : String(error)}`
      })
  });
  return ids.map((id, i) => toResult(id, response.results[i]));
});

/**
 * Extracts heap-dump ids from the log, dedups them, and batch-fetches their overlay results
 * via the tooling composite/batch API (25 per batch, up to 15 batches in flight).
 */
export const fetchHeapDumpOverlayResults = Effect.fn('heapDumpOverlayFetch.fetchHeapDumpOverlayResults')(function* (
  conn: Connection,
  logFileContents: string
) {
  const uniqueIds = [
    ...new Set(extractHeapDumpIdsFromLog(logFileContents.split(/\r?\n/)).map(entry => entry.heapDumpId))
  ];
  const results = yield* Stream.fromIterable(uniqueIds).pipe(
    Stream.grouped(MAX_BATCH_SIZE),
    Stream.mapEffect(chunk => runOverlayBatch(conn, Chunk.toArray(chunk)), { concurrency: BATCH_API_CONCURRENCY }),
    Stream.flattenIterables,
    Stream.runCollect
  );
  return Chunk.toArray(results);
});
