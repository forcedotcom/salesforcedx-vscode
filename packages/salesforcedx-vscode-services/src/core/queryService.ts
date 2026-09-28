/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * SOQL over a jsforce `Connection`. Omit `connection` to use `ConnectionService.getConnection()`.
 * Pass `connection` to query a specific org. First page keeps `totalSize`. `records` is a stream of
 * that page plus every `nextRecordsUrl` page, collected before return. `maxFetch` stops the stream.
 * Totals-only envelopes (`SELECT COUNT()`) yield `records: []`.
 */

import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import { isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { QueryError } from '../errors/queryErrors';
import { ConnectionService } from './connectionService';
import { executeQuery, type QueryOptions, type QueryServiceResult } from './queryExecute';

type DefaultConnectionError = Effect.Effect.Error<ReturnType<ConnectionService['getConnection']>>;

// Overloads: passing `connection` keeps R = never. An arrow cannot be assigned to that
// overload type without an assertion, which consistent-type-assertions forbids.
/* eslint-disable prefer-arrow/prefer-arrow-functions */
function query<A, I>(
  options: QueryOptions & { readonly connection: Connection },
  recordSchema: Schema.Schema<A, I, never>
): Effect.Effect<QueryServiceResult<A>, QueryError>;
function query<A, I>(
  options: QueryOptions,
  recordSchema: Schema.Schema<A, I, never>
): Effect.Effect<QueryServiceResult<A>, QueryError | DefaultConnectionError, ConnectionService>;
function query<A, I>(options: QueryOptions, recordSchema: Schema.Schema<A, I, never>) {
  return (
    isUndefined(options.connection)
      ? ConnectionService.pipe(Effect.flatMap(service => service.getConnection()))
      : Effect.succeed(options.connection)
  ).pipe(Effect.flatMap(connection => executeQuery(connection, options, recordSchema)));
}
/* eslint-enable prefer-arrow/prefer-arrow-functions */

export class QueryService extends Effect.Service<QueryService>()('QueryService', {
  accessors: false,
  effect: Effect.succeed({ query })
}) {}
