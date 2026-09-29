/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import { UnknownException } from 'effect/Cause';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { isNotUndefined, isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { FieldError, SoqlError } from '../errors/queryErrors';
import { unknownToErrorCause } from './shared';

export type QueryOptions = {
  readonly soql: string;
  readonly tooling?: boolean;
  readonly scanAll?: boolean;
  readonly orgId?: string;
};

export type QueryServiceResult<A, E = never, R = never> = {
  readonly totalSize: number;
  readonly records: Stream.Stream<A, E, R>;
};

const SOQL_ERROR_CODES: ReadonlySet<string> = new Set([
  'MALFORMED_QUERY',
  'INVALID_TYPE',
  'INVALID_QUERY_FILTER_OPERATOR',
  'INVALID_SEARCH',
  'INVALID_QUERY_LOCATOR'
]);

const FIELD_ERROR_CODES: ReadonlySet<string> = new Set(['INVALID_FIELD', 'INVALID_FIELD_FOR_INSERT_UPDATE']);

/** jsforce / Salesforce REST failure shape used to refine into SoqlError / FieldError. */
const JsforceApiFailure = Schema.Struct({
  message: Schema.String,
  errorCode: Schema.String,
  statusCode: Schema.optional(Schema.Number),
  fields: Schema.Array(Schema.String).pipe(Schema.optional),
  data: Schema.optional(
    Schema.Struct({
      message: Schema.optional(Schema.String),
      errorCode: Schema.optional(Schema.String),
      statusCode: Schema.optional(Schema.Number),
      fields: Schema.Array(Schema.String).pipe(Schema.optional)
    })
  )
});

const QueryEnvelope = <A, I>(recordSchema: Schema.Schema<A, I, never>) =>
  Schema.Struct({
    totalSize: Schema.Number,
    done: Schema.optionalWith(Schema.Boolean, { default: () => true }),
    nextRecordsUrl: Schema.optional(Schema.String),
    records: Schema.optionalWith(Schema.Array(recordSchema), { default: () => [] })
  });

type QueryEnvelopeType<A> = {
  readonly totalSize: number;
  readonly done: boolean;
  readonly nextRecordsUrl?: string;
  readonly records: readonly A[];
};

const refineSoqlError = (soql: string, error: unknown): SoqlError | FieldError | UnknownException => {
  const decoded = Schema.decodeUnknownOption(JsforceApiFailure)(error);
  if (Option.isNone(decoded)) {
    return new UnknownException(error);
  }
  const failure = decoded.value;
  const fields = failure.fields ?? failure.data?.fields;
  const statusCode = failure.statusCode ?? failure.data?.statusCode ?? 400;
  const message = failure.message || unknownToErrorCause(error).message;
  return FIELD_ERROR_CODES.has(failure.errorCode) && isNotUndefined(fields) && fields.length > 0
    ? new FieldError({ soql, errorCode: failure.errorCode, statusCode, message, fields })
    : SOQL_ERROR_CODES.has(failure.errorCode) || FIELD_ERROR_CODES.has(failure.errorCode)
      ? new SoqlError({ soql, errorCode: failure.errorCode, statusCode, message })
      : new UnknownException(error);
};

const queryApi = (connection: Connection, tooling: boolean) => (tooling ? connection.tooling : connection);

const fetchPage = <A, I>(
  connection: Connection,
  recordSchema: Schema.Schema<A, I, never>,
  soql: string,
  tooling: boolean,
  scanAll: boolean,
  page: { readonly first: true } | { readonly nextRecordsUrl: string }
) => {
  const api = queryApi(connection, tooling);
  return Effect.tryPromise({
    try: () => Promise.resolve('first' in page ? api.query(soql, { scanAll }) : api.queryMore(page.nextRecordsUrl)),
    catch: error => refineSoqlError(soql, error)
  }).pipe(Effect.flatMap(body => Schema.decodeUnknown(QueryEnvelope(recordSchema))(body)));
};

const fetchRecordsPage =
  <A, I>(connection: Connection, recordSchema: Schema.Schema<A, I, never>, soql: string, tooling: boolean) =>
  (nextRecordsUrl: string) =>
    fetchPage(connection, recordSchema, soql, tooling, false, { nextRecordsUrl }).pipe(
      Effect.map((page): readonly [Chunk.Chunk<A>, Option.Option<string>] => [
        Chunk.fromIterable(page.records),
        page.done || isUndefined(page.nextRecordsUrl) ? Option.none() : Option.some(page.nextRecordsUrl)
      ])
    );

/** Runs against `connection` only. Identity lookup uses this so it does not call `getConnection()`. */
export const executeQuery = <A, I>(
  connection: Connection,
  options: QueryOptions,
  recordSchema: Schema.Schema<A, I, never>
) => {
  const soql = options.soql;
  const tooling = options.tooling ?? false;
  const scanAll = options.scanAll ?? false;
  return fetchPage(connection, recordSchema, soql, tooling, scanAll, { first: true }).pipe(
    Effect.map((firstPage: QueryEnvelopeType<A>) => ({
      totalSize: firstPage.totalSize,
      records: Stream.fromIterable(firstPage.records).pipe(
        Stream.concat(
          firstPage.done || isUndefined(firstPage.nextRecordsUrl)
            ? Stream.empty
            : Stream.paginateChunkEffect(
                firstPage.nextRecordsUrl,
                fetchRecordsPage(connection, recordSchema, soql, tooling)
              )
        )
      )
    }))
  );
};
