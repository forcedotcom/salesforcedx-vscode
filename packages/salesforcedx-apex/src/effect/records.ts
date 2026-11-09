/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import { getErrorMessage } from '@salesforce/salesforcedx-utils';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import type { ParseError } from 'effect/ParseResult';
import { isNotUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import {
  ApexOperationError,
  ApexQueryRequestError,
  ApexResponseDecodeError,
  ApexToolingMutationError
} from './schema/errors';
import { QueryPageSchema } from './schema/queryPage';
import { RecordSaveResultSchema } from './schema/wire/records';

const requestErrorMessage = (cause: unknown): string => {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === 'object' && cause !== null && 'message' in cause && typeof cause.message === 'string') {
    return cause.message;
  }
  return getErrorMessage(cause);
};

/** Streams decoded pages for either REST or Tooling queries, following each continuation URL. */
export const queryRecordPages = <A, I>({
  connection,
  operation,
  soql,
  record,
  tooling = false
}: {
  connection: Connection;
  operation: string;
  soql: string;
  record: Schema.Schema<A, I, never>;
  tooling?: boolean;
}): Stream.Stream<readonly A[], ApexQueryRequestError | ParseError> => {
  const queryConnection = tooling ? connection.tooling : connection;
  const pageSchema = QueryPageSchema(record);
  return Stream.paginateEffect<string | undefined, readonly A[], ApexQueryRequestError | ParseError, never>(
    undefined,
    nextRecordsUrl =>
      Effect.tryPromise({
        try: () =>
          Promise.resolve(
            isNotUndefined(nextRecordsUrl) ? queryConnection.queryMore(nextRecordsUrl) : queryConnection.query(soql)
          ),
        catch: cause => {
          const message = requestErrorMessage(cause);
          return new ApexQueryRequestError({ operation, message, cause });
        }
      }).pipe(
        Effect.flatMap(Schema.decodeUnknown(pageSchema)),
        Effect.map(
          page => [page.records, page.done ? Option.none<string>() : Option.fromNullable(page.nextRecordsUrl)] as const
        )
      )
  );
};

/** Runs a record write and validates its SaveResult with the expected record ID schema. */
const requestSaveResult = <A, I, R>(
  operation: string,
  idSchema: Schema.Schema<A, I, R>,
  request: () => PromiseLike<unknown>
) =>
  Effect.tryPromise({
    try: () => Promise.resolve(request()),
    catch: cause =>
      new ApexOperationError({ operation, message: getErrorMessage(cause), cause: getErrorMessage(cause) })
  }).pipe(
    Effect.flatMap(Schema.decodeUnknown(RecordSaveResultSchema(idSchema))),
    Effect.catchTag('ParseError', cause =>
      Effect.fail(
        new ApexResponseDecodeError({ operation, message: 'Invalid Tooling mutation response', cause: cause.message })
      )
    ),
    Effect.flatMap(result =>
      result.success
        ? Effect.succeed(result)
        : Effect.fail(
            new ApexToolingMutationError({
              operation,
              message: `Tooling ${operation} returned errors: ${result.errors.map(requestErrorMessage).join('; ')}`
            })
          )
    )
  );

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
    operation,
    soql,
    record,
    tooling
  }).pipe(
    Stream.mapError(error =>
      error._tag === 'ApexQueryRequestError'
        ? new ApexOperationError({ operation, message: error.message, cause: getErrorMessage(error.cause) })
        : new ApexResponseDecodeError({ operation, message: error.message, cause: error.message })
    ),
    Stream.flatMap(Stream.fromIterable),
    Stream.runCollect,
    Effect.map(Chunk.toReadonlyArray)
  );
});

export const createRecord = Effect.fn('Apex.createRecord')(function* <A, I, R, F extends object>({
  connection,
  operation,
  type,
  fields,
  idSchema
}: {
  connection: Connection;
  operation: string;
  type: string;
  fields: F;
  idSchema: Schema.Schema<A, I, R>;
}) {
  const result = yield* requestSaveResult(operation, idSchema, () => connection.tooling.create(type, { ...fields }));
  return { id: result.id };
});

export const updateRecord = Effect.fn('Apex.updateRecord')(function* <A extends string, I, R, F extends object>({
  connection,
  operation,
  type,
  recordId,
  fields,
  idSchema
}: {
  connection: Connection;
  operation: string;
  type: string;
  recordId: A;
  fields: F;
  idSchema: Schema.Schema<A, I, R>;
}) {
  yield* requestSaveResult(operation, idSchema, () =>
    connection.tooling.update(type, { ...fields, Id: recordId })
  ).pipe(Effect.asVoid);
});

export const deleteRecord = Effect.fn('Apex.deleteRecord')(function* <A extends string, I, R>({
  connection,
  operation,
  type,
  recordId,
  idSchema
}: {
  connection: Connection;
  operation: string;
  type: string;
  recordId: A;
  idSchema: Schema.Schema<A, I, R>;
}) {
  yield* requestSaveResult(operation, idSchema, () => connection.tooling.delete(type, recordId)).pipe(Effect.asVoid);
});
