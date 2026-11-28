/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { QueryResult } from '../types';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { JsonObject } from '../json';
import { prepareQuery } from '../prepareQuery';

export const runQuery = Effect.fn('runQuery')(function* (queryText: string, options?: { readonly maxRows?: number }) {
  const maxRows = options?.maxRows ?? 50_000;
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const queryResult = yield* api.v2.services.QueryService.use(service =>
    service.query(prepareQuery(queryText), input =>
      Schema.decodeUnknownEffect(Schema.Struct({ totalSize: Schema.Number, records: Schema.Array(JsonObject) }))(input)
    )
  );
  const records = yield* Stream.take(queryResult.records, maxRows).pipe(Stream.runCollect);
  return {
    done: true,
    totalSize: queryResult.totalSize,
    records: flattenQueryRecords(records)
  } satisfies QueryResult<JsonObject>;
});
/**
  As query complexity grows
  we will need to flatten the results of nested values
  in order to be parsed and displayed correctly
 */
const flattenQueryRecords = (rawQueryRecords: readonly JsonObject[]) =>
  // filter out the attributes key
  rawQueryRecords.map(({ attributes, ...cleanRecords }) => cleanRecords);
