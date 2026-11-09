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
import type { ParseError } from 'effect/ParseResult';
import { isNotUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { causeMessage } from './errors';
import { ApexOperationError, ApexResponseDecodeError } from './schema/errors';
import { QueryPageSchema } from './schema/queryPage';
import { createRecordResponseSchema } from './schema/wire/records';

/** Streams decoded pages for either REST or Tooling queries, following each continuation URL. */
export const queryRecordPages = <A, I, ERequest, EDecode>({
  connection,
  soql,
  record,
  tooling = false,
  onRequestError,
  onDecodeError
}: {
  connection: Connection;
  soql: string;
  record: Schema.Schema<A, I, never>;
  tooling?: boolean;
  onRequestError: (cause: unknown) => ERequest;
  onDecodeError: (cause: ParseError) => EDecode;
}): Stream.Stream<readonly A[], ERequest | EDecode> => {
  const queryConnection = tooling ? connection.tooling : connection;
  const pageSchema = QueryPageSchema(record);
  return Stream.paginateEffect<string | undefined, readonly A[], ERequest | EDecode, never>(undefined, nextRecordsUrl =>
    Effect.tryPromise({
      try: () =>
        Promise.resolve(
          isNotUndefined(nextRecordsUrl) ? queryConnection.queryMore(nextRecordsUrl) : queryConnection.query(soql)
        ),
      catch: onRequestError
    }).pipe(
      Effect.flatMap(response => Schema.decodeUnknown(pageSchema)(response).pipe(Effect.mapError(onDecodeError))),
      Effect.map(
        page => [page.records, page.done ? Option.none<string>() : Option.fromNullable(page.nextRecordsUrl)] as const
      )
    )
  );
};

export const collectQueryPages = <A, E, R>(pages: Stream.Stream<readonly A[], E, R>) =>
  pages.pipe(Stream.flatMap(Stream.fromIterable), Stream.runCollect, Effect.map(Chunk.toReadonlyArray));

export const queryRecords = Effect.fn('Apex.queryRecords')(function* <A, I>({
  connection,
  operation,
  soql,
  record,
  tooling = false
}: {
  connection: Connection;
  operation: string;
  soql: string;
  record: Schema.Schema<A, I>;
  tooling?: boolean;
}) {
  return yield* queryRecordPages({
    connection,
    soql,
    record,
    tooling,
    onRequestError: cause =>
      new ApexOperationError({ operation, message: causeMessage(cause), cause: causeMessage(cause) }),
    onDecodeError: cause =>
      new ApexResponseDecodeError({ operation, message: 'Invalid query response', cause: cause.message })
  }).pipe(collectQueryPages);
});

export const createRecord = Effect.fn('Apex.createRecord')(function* ({
  connection,
  operation,
  type,
  fields
}: {
  connection: Connection;
  operation: string;
  type: string;
  fields: Record<string, string>;
}) {
  return yield* Effect.tryPromise({
    try: () => Promise.resolve(connection.tooling.create(type, fields)),
    catch: cause => new ApexOperationError({ operation, message: causeMessage(cause), cause: causeMessage(cause) })
  }).pipe(
    Effect.flatMap(Schema.decodeUnknown(createRecordResponseSchema)),
    Effect.catchTag('ParseError', cause =>
      Effect.fail(new ApexResponseDecodeError({ operation, message: 'Invalid create response', cause: cause.message }))
    )
  );
});
