/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  createSalesforceClient,
  query as sdkQuery,
  restRequest as sdkRestRequest,
  type Query as StructuredQuery,
  type QueryError as SfEffectQueryError,
  type SalesforceClient
} from '@salesforce/sf-effect-sdk/promise';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Either from 'effect/Either';
import * as Option from 'effect/Option';
import * as ParseResult from 'effect/ParseResult';
import { hasProperty, isBoolean, isError, isNumber, isRecord, isString, isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as SchemaAST from 'effect/SchemaAST';
import * as Stream from 'effect/Stream';
import { ConnectionService } from './connectionService';

export type QueryOptions = {
  readonly tooling?: boolean;
  readonly scanAll?: boolean;
  readonly orgId?: string;
} & ({ readonly soql: string } | StructuredQuery);

export class QueryDecodeError extends Schema.TaggedError<QueryDecodeError>()('QueryDecodeError', {
  message: Schema.String
}) {}

const QueryEnvelope = Schema.Struct({
  totalSize: Schema.Number,
  done: Schema.Boolean,
  nextRecordsUrl: Schema.optional(Schema.String),
  records: Schema.Array(Schema.Unknown)
});

const isSfEffectQueryError = (error: unknown): error is SfEffectQueryError =>
  isError(error) && hasProperty(error, '_tag') && isString(error._tag);

const sdkPromise = <A>(promise: () => Promise<A>) =>
  Effect.tryPromise({
    try: promise,
    catch: error =>
      isSfEffectQueryError(error)
        ? error
        : new QueryDecodeError({ message: `Unexpected sf-effect rejection: ${String(error)}` })
  });

const recordFieldPaths = (recordSchema: Schema.Schema.Any): readonly string[] => {
  const paths = (ast: SchemaAST.AST, prefix: string): readonly string[] =>
    SchemaAST.getPropertySignatures(ast).flatMap(property => {
      if (!isString(property.name)) return [];
      const path = prefix === '' ? property.name : `${prefix}.${property.name}`;
      return [path, ...paths(property.type, path)];
    });

  return Array.from(new Set(paths(recordSchema.ast, '')));
};

const decodeEnvelope = (value: unknown) => {
  const result = Schema.decodeUnknownEither(QueryEnvelope)(value);
  return Either.isLeft(result)
    ? Effect.fail(new QueryDecodeError({ message: ParseResult.TreeFormatter.formatErrorSync(result.left) }))
    : Effect.succeed(result.right);
};

const decodeRecords = <A, I>(recordSchema: Schema.Schema<A, I, never>, records: readonly unknown[]) =>
  Schema.decodeUnknown(Schema.Array(recordSchema))(records).pipe(
    Effect.mapError(error => new QueryDecodeError({ message: ParseResult.TreeFormatter.formatErrorSync(error) }))
  );

const isQueryResult = (
  value: unknown
): value is Record<string, unknown> & {
  readonly totalSize: number;
  readonly done: boolean;
  readonly nextRecordsUrl?: unknown;
  readonly records: unknown[];
} => isRecord(value) && isNumber(value.totalSize) && isBoolean(value.done) && Array.isArray(value.records);

const completeRelationshipQuery = (client: SalesforceClient, record: unknown) => {
  const fetchRemainingRecords = (nextRecordsUrl: string) =>
    Stream.paginateChunkEffect(nextRecordsUrl, url =>
      sdkPromise(() => sdkRestRequest({ client, method: 'GET', path: url })).pipe(
        Effect.flatMap(decodeEnvelope),
        Effect.map(
          page =>
            [
              Chunk.fromIterable(page.records),
              page.done || !page.nextRecordsUrl ? Option.none<string>() : Option.some(page.nextRecordsUrl)
            ] as const
        )
      )
    ).pipe(Stream.runCollect, Effect.map(Chunk.toReadonlyArray));

  return Effect.gen(function* () {
    if (!isRecord(record)) return record;
    return Object.fromEntries(
      yield* Effect.forEach(Object.entries(record), ([key, value]) =>
        !isQueryResult(value) || !isString(value.nextRecordsUrl)
          ? Effect.succeed([key, value] as const)
          : fetchRemainingRecords(value.nextRecordsUrl).pipe(
              Effect.map(
                remainingRecords =>
                  [
                    key,
                    {
                      ...value,
                      records: [...value.records, ...remainingRecords],
                      done: true,
                      nextRecordsUrl: undefined
                    }
                  ] as const
              )
            )
      )
    );
  });
};

const sdkQueryOptions = (options: QueryOptions, client: SalesforceClient) =>
  hasProperty(options, 'soql')
    ? {
        client,
        soql: options.soql,
        tooling: options.tooling,
        scanAll: options.scanAll
      }
    : {
        client,
        from: options.from,
        fields: options.fields,
        where: options.where,
        orderBy: options.orderBy,
        limit: options.limit,
        offset: options.offset,
        tooling: options.tooling,
        scanAll: options.scanAll
      };

export class QueryService extends Effect.Service<QueryService>()('QueryService', {
  dependencies: [ConnectionService.Default],
  effect: Effect.gen(function* () {
    const connectionService = yield* ConnectionService;

    const query = Effect.fn('QueryService.query')(function* <A, I>(
      options: QueryOptions,
      recordSchema: Schema.Schema<A, I, never>
    ) {
      const connection = yield* isUndefined(options.orgId)
        ? connectionService.getConnection()
        : connectionService.getConnectionForOrg(options.orgId);
      const accessToken = connection.accessToken;
      if (!isString(accessToken)) {
        return yield* new QueryDecodeError({ message: 'The Salesforce connection has no access token' });
      }
      const client = yield* sdkPromise(() =>
        createSalesforceClient({
          instanceUrl: new URL(connection.instanceUrl),
          accessToken,
          apiVersion: connection.getApiVersion(),
          refreshAccessToken: async () => {
            await connection.refreshAuth();
            const refreshedAccessToken = connection.accessToken;
            return isString(refreshedAccessToken)
              ? refreshedAccessToken
              : Promise.reject(new Error('The refreshed Salesforce connection has no access token'));
          }
        })
      );
      const result = yield* sdkPromise(() =>
        sdkQuery(sdkQueryOptions(options, client), recordFieldPaths(recordSchema))
      );
      const records = Stream.fromAsyncIterable(result.records, error =>
        isSfEffectQueryError(error)
          ? error
          : new QueryDecodeError({ message: `Unexpected sf-effect rejection: ${String(error)}` })
      ).pipe(
        Stream.mapEffect(record => completeRelationshipQuery(client, record)),
        Stream.mapEffect(record => decodeRecords(recordSchema, [record])),
        Stream.mapConcat(decodedRecords => decodedRecords)
      );

      return { totalSize: result.totalSize, records };
    });

    return { query };
  })
}) {}
