/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * SOQL over a jsforce `Connection`. First page keeps `totalSize`. `records` is
 * collected from the page stream. `maxFetch` stops that stream; omitted
 * `maxFetch` is the first page only. `records` is absent on totals-only
 * envelopes (`SELECT COUNT()`).
 */

import type { Connection } from '@salesforce/core';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as ParseResult from 'effect/ParseResult';
import { isError, isRecord, isString, isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { QueryError } from '../errors/queryErrors';

const UnknownRecords = Schema.Array(Schema.Unknown);

const QueryPage = Schema.Struct({
  totalSize: Schema.Number,
  done: Schema.optional(Schema.Boolean),
  nextRecordsUrl: Schema.optional(Schema.String),
  records: Schema.optional(UnknownRecords)
});

type QueryPage = Schema.Schema.Type<typeof QueryPage>;

type QueryOptions = {
  readonly soql: string;
  readonly tooling?: boolean;
  readonly scanAll?: boolean;
  readonly maxFetch?: number;
};

const messageOf = (error: unknown): string =>
  isError(error) ? error.message : isRecord(error) && isString(error.message) ? error.message : String(error);

const queryFailure = (error: unknown): QueryError => {
  const errorCode = isRecord(error) ? error.errorCode : undefined;
  return new QueryError({
    message: messageOf(error),
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

const nextPage = (connection: Connection, url: string) =>
  fetchPage(connection, url).pipe(
    Effect.map(
      page =>
        [
          Chunk.fromIterable(page.records ?? []),
          isString(page.nextRecordsUrl) && page.done !== true ? Option.some(page.nextRecordsUrl) : Option.none()
        ] as const
    )
  );

const parentRecords = (
  connection: Connection,
  firstRecords: readonly unknown[],
  page: QueryPage,
  maxFetch: number | undefined
) => {
  const rest =
    isUndefined(maxFetch) || page.done === true || !isString(page.nextRecordsUrl)
      ? Stream.empty
      : Stream.paginateChunkEffect(page.nextRecordsUrl, url => nextPage(connection, url));
  const combined = Stream.concat(Stream.fromIterable(firstRecords), rest);
  return isUndefined(maxFetch) ? combined : Stream.take(combined, maxFetch);
};

type ChildQuery = Record<string, unknown> & {
  readonly records: readonly unknown[];
  readonly nextRecordsUrl: string;
};

const isChildQuery = (value: unknown): value is ChildQuery =>
  isRecord(value) && Array.isArray(value.records) && isString(value.nextRecordsUrl);

const childWithAllRecords = (value: ChildQuery, records: readonly unknown[]) => ({
  ...Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'nextRecordsUrl')),
  records,
  done: true
});

const remainingChildRecords = (connection: Connection, nextRecordsUrl: string) =>
  Stream.paginateChunkEffect(nextRecordsUrl, url => nextPage(connection, url)).pipe(
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  );

/** jsforce `autoFetch` follows child `nextRecordsUrl`. Only when `maxFetch` is set. */
const expandChildren = (connection: Connection, record: unknown) => {
  if (!isRecord(record)) {
    return Effect.succeed(record);
  }
  const children = Object.entries(record).filter((entry): entry is [string, ChildQuery] => isChildQuery(entry[1]));
  return children.length === 0
    ? Effect.succeed(record)
    : Effect.forEach(children, ([key, value]) =>
        remainingChildRecords(connection, value.nextRecordsUrl).pipe(
          Effect.map(more => [key, childWithAllRecords(value, [...value.records, ...more])] as const)
        )
      ).pipe(Effect.map(updates => ({ ...record, ...Object.fromEntries(updates) })));
};

type QueryServiceResult<A> = {
  readonly totalSize: number;
  readonly records?: readonly A[];
};

const query = <A, I>(connection: Connection, options: QueryOptions, recordSchema: Schema.Schema<A, I, never>) =>
  Effect.gen(function* () {
    const page = yield* fetchPage(
      connection,
      queryUrl(connection, options.soql, options.tooling ?? false, options.scanAll ?? false)
    );
    if (isUndefined(page.records)) {
      return { totalSize: page.totalSize };
    }
    const rawRecords = Chunk.toReadonlyArray(
      yield* Stream.runCollect(parentRecords(connection, page.records, page, options.maxFetch))
    );
    const expanded = isUndefined(options.maxFetch)
      ? rawRecords
      : yield* Effect.forEach(rawRecords, record => expandChildren(connection, record));
    return yield* Schema.decodeUnknown(Schema.Array(recordSchema))(expanded).pipe(
      Effect.mapError(decodeFailure),
      Effect.map((records): QueryServiceResult<A> => ({ totalSize: page.totalSize, records }))
    );
  }).pipe(Effect.withSpan('QueryService.query'));

export class QueryService extends Effect.Service<QueryService>()('QueryService', {
  accessors: true,
  effect: Effect.succeed({ query })
}) {}
