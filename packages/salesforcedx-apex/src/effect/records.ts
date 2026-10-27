/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { causeMessage } from './errors';
import { ApexOperationError, ApexResponseDecodeError } from './schema/errors';
import { createRecordResponseSchema, queryRecordsResponseSchema } from './schema/wire/records';

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
  return yield* Effect.tryPromise({
    try: () => Promise.resolve((tooling ? connection.tooling : connection).query(soql)),
    catch: cause => new ApexOperationError({ operation, message: causeMessage(cause), cause: causeMessage(cause) })
  }).pipe(
    Effect.flatMap(Schema.decodeUnknown(queryRecordsResponseSchema(record))),
    Effect.catchTag('ParseError', cause =>
      Effect.fail(new ApexResponseDecodeError({ operation, message: 'Invalid query response', cause: cause.message }))
    ),
    Effect.map(result => result.records)
  );
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
