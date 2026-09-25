/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import { isError, isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';

const UnknownRecords = Schema.Array(Schema.Unknown);

const QueryPage = Schema.Struct({
  totalSize: Schema.Number,
  records: Schema.optional(UnknownRecords)
});

class SoqlRequestError extends Schema.TaggedError<SoqlRequestError>()('SoqlRequestError', {
  message: Schema.String,
  cause: Schema.Unknown
}) {}

const requestFailure = (cause: unknown) =>
  new SoqlRequestError({
    message: isError(cause) ? cause.message : String(cause),
    cause
  });

const requestQueryPage = (connection: Connection, soql: string, tooling: boolean) =>
  Effect.tryPromise({
    try: () =>
      connection.request({
        method: 'GET',
        url: `${connection.instanceUrl}/services/data/v${connection.getApiVersion()}/${tooling ? 'tooling/' : ''}query?q=${encodeURIComponent(soql)}`
      }),
    catch: requestFailure
  }).pipe(Effect.flatMap(Schema.decodeUnknown(QueryPage)));

type QueryConnectionResult<A> = {
  readonly totalSize: number;
  readonly records?: readonly A[];
};

const queryResult = <A>(totalSize: number, records?: readonly A[]): QueryConnectionResult<A> => ({
  totalSize,
  records
});

/** First page of a SOQL query on the connection the caller already holds. */
export const queryConnection = <A, I>(
  connection: Connection,
  soql: string,
  recordSchema: Schema.Schema<A, I, never>,
  tooling = false
): Promise<QueryConnectionResult<A>> =>
  requestQueryPage(connection, soql, tooling).pipe(
    Effect.flatMap(page =>
      isUndefined(page.records)
        ? Effect.succeed(queryResult<A>(page.totalSize))
        : Schema.decodeUnknown(Schema.Array(recordSchema))(page.records).pipe(
            Effect.map(records => queryResult<A>(page.totalSize, records))
          )
    ),
    Effect.runPromise
  );
