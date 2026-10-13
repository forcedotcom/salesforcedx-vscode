/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { QueryResult } from '../types';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as soqlComments from '@salesforce/soql-common/soqlComments';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import { JsonObject } from '../json';
import { stripAllRows } from './allRows';

export const runQuery = Effect.fn('runQuery')(function* (queryText: string, options?: { readonly maxRows?: number }) {
  const maxRows = options?.maxRows ?? 50_000;
  return yield* Effect.flatMap(ExtensionProviderService, provider => provider.getServicesApi).pipe(
    Effect.flatMap(api => api.services.QueryService),
    Effect.flatMap(queryService =>
      queryService.query(
        {
          ...stripAllRows(soqlComments.parseHeaderComments(queryText).soqlText)
        },
        JsonObject
      )
    ),
    Effect.flatMap(({ totalSize, records }) =>
      Stream.take(records, maxRows).pipe(
        Stream.runCollect,
        Effect.map(
          (chunk): QueryResult<JsonObject> => ({
            done: true,
            totalSize,
            records: flattenQueryRecords(chunk.pipe(Chunk.toReadonlyArray))
          })
        )
      )
    )
  );
});
/**
  As query complexity grows
  we will need to flatten the results of nested values
  in order to be parsed and displayed correctly
 */
const flattenQueryRecords = (rawQueryRecords: readonly JsonObject[]) =>
  // filter out the attributes key
  rawQueryRecords.map(({ attributes, ...cleanRecords }) => cleanRecords);
