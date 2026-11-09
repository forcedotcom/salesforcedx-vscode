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
import { isNotUndefined, isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { ApexOperationError, ApexResponseDecodeError, ApexToolingMutationError } from './schema/errors';
import { QueryPageSchema } from './schema/queryPage';
import { ToolingMutationResponseSchema } from './schema/wire/records';

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
}): Stream.Stream<readonly A[], ApexOperationError | ApexResponseDecodeError> => {
  const queryConnection = tooling ? connection.tooling : connection;
  const pageSchema = QueryPageSchema(record);
  return Stream.paginateEffect<string | undefined, readonly A[], ApexOperationError | ApexResponseDecodeError, never>(
    undefined,
    nextRecordsUrl =>
      Effect.tryPromise({
        try: () =>
          Promise.resolve(
            isNotUndefined(nextRecordsUrl) ? queryConnection.queryMore(nextRecordsUrl) : queryConnection.query(soql)
          ),
        catch: cause => {
          const message = requestErrorMessage(cause);
          return new ApexOperationError({ operation, message, cause: message });
        }
      }).pipe(
        Effect.flatMap(response =>
          Schema.decodeUnknown(pageSchema)(response).pipe(
            Effect.mapError(
              cause => new ApexResponseDecodeError({ operation, message: cause.message, cause: cause.message })
            )
          )
        ),
        Effect.map(
          page => [page.records, page.done ? Option.none<string>() : Option.fromNullable(page.nextRecordsUrl)] as const
        )
      )
  );
};

export const collectQueryPages = <A, E, R>(pages: Stream.Stream<readonly A[], E, R>) =>
  pages.pipe(Stream.flatMap(Stream.fromIterable), Stream.runCollect, Effect.map(Chunk.toReadonlyArray));

/** Runs a Tooling mutation and validates its SaveResult with the expected record ID schema. */
export const toolingMutation = <A, I, R>(
  operation: string,
  idSchema: Schema.Schema<A, I, R>,
  request: () => PromiseLike<unknown>
) =>
  Effect.tryPromise({
    try: () => Promise.resolve(request()),
    catch: cause =>
      new ApexOperationError({ operation, message: getErrorMessage(cause), cause: getErrorMessage(cause) })
  }).pipe(
    Effect.flatMap(Schema.decodeUnknown(ToolingMutationResponseSchema(idSchema))),
    Effect.catchTag('ParseError', cause =>
      Effect.fail(
        new ApexResponseDecodeError({ operation, message: 'Invalid Tooling mutation response', cause: cause.message })
      )
    ),
    Effect.flatMap(result =>
      result.success
        ? Effect.succeed(result)
        : Effect.fail(
            new ApexToolingMutationError({ operation, message: `Tooling ${operation} returned success=false` })
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
  }).pipe(collectQueryPages);
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
  const result = yield* toolingMutation(operation, idSchema, () => connection.tooling.create(type, { ...fields }));
  if (isUndefined(result.id)) {
    return yield* new ApexToolingMutationError({ operation, message: `Tooling ${operation} returned no ID` });
  }
  return { id: result.id };
});
