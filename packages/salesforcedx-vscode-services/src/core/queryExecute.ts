/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as ParseResult from 'effect/ParseResult';
import { isRecord, isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { QueryError } from '../errors/queryErrors';
import { getErrorMessage } from '../vscode/errorHandlerService';

const QueryRecord = Schema.Record({ key: Schema.String, value: Schema.Unknown });

type QueryRecord = Schema.Schema.Type<typeof QueryRecord>;

const QueryRecords = Schema.Array(QueryRecord);

const FinishedQueryPage = Schema.Struct({
  totalSize: Schema.Number,
  done: Schema.Literal(true),
  records: Schema.optional(QueryRecords)
});

const NextRecordsPage = Schema.Struct({
  totalSize: Schema.Number,
  done: Schema.Literal(false),
  nextRecordsUrl: Schema.String,
  records: QueryRecords
});

type NextRecordsPage = Schema.Schema.Type<typeof NextRecordsPage>;

const QueryPage = Schema.Union(FinishedQueryPage, NextRecordsPage);

export type QueryOptions = {
  readonly soql: string;
  readonly tooling?: boolean;
  readonly scanAll?: boolean;
  readonly maxFetch?: number;
  /** Specific org connection. Omit to use `ConnectionService.getConnection()`. */
  readonly connection?: Connection;
};

export type QueryServiceResult<A> = {
  readonly totalSize: number;
  readonly records: readonly A[];
};

const queryFailure = (error: unknown): QueryError => {
  const errorCode = isRecord(error) ? error.errorCode : undefined;
  return new QueryError({
    message: getErrorMessage(error),
    cause: error,
    ...(isUndefined(errorCode) ? {} : { errorCode })
  });
};

const decodeFailure = (parseError: ParseResult.ParseError): QueryError =>
  new QueryError({
    message: `Failed to decode query response: ${ParseResult.TreeFormatter.formatErrorSync(parseError)}`,
    cause: parseError
  });

const queryUrl = (connection: Connection, soql: string, tooling: boolean, scanAll: boolean): string =>
  `${connection.instanceUrl}/services/data/v${connection.getApiVersion()}/${tooling ? 'tooling/' : ''}${
    scanAll ? 'queryAll' : 'query'
  }?q=${encodeURIComponent(soql)}`;

const fetchPage = (connection: Connection, url: string) =>
  Effect.tryPromise({
    try: () => connection.request({ method: 'GET', url }),
    catch: queryFailure
  }).pipe(Effect.flatMap(body => Schema.decodeUnknown(QueryPage)(body).pipe(Effect.mapError(decodeFailure))));

/** Later pages. `Stream.paginateChunkEffect` is this Effect version of sf-effect's array-flattening `Stream.paginate`. */
const fetchRecordsPage = (connection: Connection) => (nextRecordsUrl: string) =>
  fetchPage(connection, nextRecordsUrl).pipe(
    Effect.map((page): readonly [Chunk.Chunk<QueryRecord>, Option.Option<string>] => [
      Chunk.fromIterable(page.records ?? []),
      page.done ? Option.none() : Option.some(page.nextRecordsUrl)
    ])
  );

const pageWithAllRecords = (page: NextRecordsPage, records: readonly QueryRecord[]) => ({
  ...Object.fromEntries(Object.entries(page).filter(([key]) => key !== 'nextRecordsUrl')),
  records,
  done: true
});

const remainingRecords = (connection: Connection, nextRecordsUrl: string) =>
  Stream.paginateChunkEffect(nextRecordsUrl, fetchRecordsPage(connection)).pipe(
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  );

/** A nested query result that still has `nextRecordsUrl` is paged the same way, then returned finished. */
const followNextRecords = (connection: Connection, record: QueryRecord) => {
  const nextPages = Object.entries(record).filter((entry): entry is [string, NextRecordsPage] =>
    Schema.is(NextRecordsPage)(entry[1])
  );
  return nextPages.length === 0
    ? Effect.succeed(record)
    : Effect.forEach(nextPages, ([key, page]) =>
        remainingRecords(connection, page.nextRecordsUrl).pipe(
          Effect.map(more => [key, pageWithAllRecords(page, [...page.records, ...more])] as const)
        )
      ).pipe(Effect.map(updates => ({ ...record, ...Object.fromEntries(updates) })));
};

/** Runs against `connection` only. Identity lookup uses this so it does not call `getConnection()`. */
export const executeQuery = <A, I>(
  connection: Connection,
  options: QueryOptions,
  recordSchema: Schema.Schema<A, I, never>
) =>
  fetchPage(connection, queryUrl(connection, options.soql, options.tooling ?? false, options.scanAll ?? false)).pipe(
    Effect.flatMap(page =>
      Stream.concat(
        Stream.fromIterable(page.records ?? []),
        page.done ? Stream.empty : Stream.paginateChunkEffect(page.nextRecordsUrl, fetchRecordsPage(connection))
      ).pipe(
        stream => (isUndefined(options.maxFetch) ? stream : Stream.take(stream, options.maxFetch)),
        Stream.runCollect,
        Effect.map(Chunk.toReadonlyArray),
        Effect.flatMap(rawRecords => Effect.forEach(rawRecords, record => followNextRecords(connection, record))),
        Effect.flatMap(rawRecords =>
          Schema.decodeUnknown(Schema.Array(recordSchema))(rawRecords).pipe(
            Effect.mapError(decodeFailure),
            Effect.map((records): QueryServiceResult<A> => ({ totalSize: page.totalSize, records }))
          )
        )
      )
    ),
    Effect.withSpan('QueryService.query')
  );
