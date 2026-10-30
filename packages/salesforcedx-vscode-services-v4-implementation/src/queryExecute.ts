/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { unknownToErrorCause } from './errorCause.js';

class SoqlError extends Schema.TaggedError<SoqlError>()('SoqlError', {
  soql: Schema.String,
  errorCode: Schema.String,
  statusCode: Schema.Number,
  message: Schema.String
}) {}
class FieldError extends Schema.TaggedError<FieldError>()('FieldError', {
  soql: Schema.String,
  errorCode: Schema.String,
  statusCode: Schema.Number,
  message: Schema.String,
  fields: Schema.Array(Schema.String)
}) {}
const ApiFailure = Schema.Struct({
  message: Schema.String,
  errorCode: Schema.String,
  statusCode: Schema.optional(Schema.Number),
  fields: Schema.String.pipe(Schema.Array, Schema.optional),
  data: Schema.optional(
    Schema.Struct({
      fields: Schema.String.pipe(Schema.Array, Schema.optional),
      statusCode: Schema.optional(Schema.Number)
    })
  )
});
const fieldCodes = new Set(['INVALID_FIELD', 'INVALID_FIELD_FOR_INSERT_UPDATE']);
const soqlCodes = new Set([
  'MALFORMED_QUERY',
  'INVALID_TYPE',
  'INVALID_QUERY_FILTER_OPERATOR',
  'INVALID_SEARCH',
  'INVALID_QUERY_LOCATOR'
]);
const refineError = (soql: string, error: unknown) => {
  const decoded = Schema.decodeUnknownOption(ApiFailure)(error);
  if (Option.isNone(decoded)) return error;
  const failure = decoded.value;
  const fields = failure.fields ?? failure.data?.fields;
  const details = {
    soql,
    errorCode: failure.errorCode,
    statusCode: failure.statusCode ?? failure.data?.statusCode ?? 400,
    message: failure.message || unknownToErrorCause(error).message
  };
  return fieldCodes.has(failure.errorCode) && fields && fields.length > 0
    ? new FieldError({ ...details, fields })
    : fieldCodes.has(failure.errorCode) || soqlCodes.has(failure.errorCode)
      ? new SoqlError(details)
      : error;
};
const Envelope = <S extends Schema.Constraint>(schema: S) =>
  Schema.Struct({
    totalSize: Schema.Number,
    done: Schema.optional(Schema.Boolean),
    nextRecordsUrl: Schema.optional(Schema.String),
    records: Schema.optional(Schema.Array(schema))
  });

/** Dependency closure for connection identity; the full QueryService remains assigned to W-24615063. */
export const executeQuery = <S extends Schema.Constraint>(
  connection: Connection,
  options: {
    readonly soql: string;
    readonly tooling?: boolean;
    readonly scanAll?: boolean;
  },
  recordSchema: S
) => {
  const api = options.tooling ? connection.tooling : connection;
  const fetchPage = (next?: string) =>
    Effect.tryPromise(() =>
      Promise.resolve(next ? api.queryMore(next) : api.query(options.soql, { scanAll: options.scanAll ?? false }))
    ).pipe(
      Effect.catchTag('UnknownError', error => {
        const refined = refineError(options.soql, error.cause);
        return Effect.fail(Schema.is(SoqlError)(refined) || Schema.is(FieldError)(refined) ? refined : error);
      }),
      Effect.flatMap(Schema.decodeUnknownEffect(Envelope(recordSchema)))
    );
  return fetchPage().pipe(
    Effect.map(first => ({
      totalSize: first.totalSize,
      records: Stream.fromIterable(first.records ?? []).pipe(
        Stream.concat(
          first.done !== false || !first.nextRecordsUrl
            ? Stream.empty
            : Stream.paginate(first.nextRecordsUrl, next =>
                fetchPage(next).pipe(
                  Effect.map(
                    page =>
                      [
                        page.records ?? [],
                        page.done === false && page.nextRecordsUrl ? Option.some(page.nextRecordsUrl) : Option.none()
                      ] as const
                  )
                )
              )
        )
      )
    }))
  );
};
