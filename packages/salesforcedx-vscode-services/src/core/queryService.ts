/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * SOQL over `ConnectionService`. `records` is a lazy `Stream` that follows
 * `nextRecordsUrl`. Caps are `Stream.take` at the caller. Pass `orgId` to query a
 * specific org; otherwise the default org connection is used.
 */

import * as Effect from 'effect/Effect';
import { isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { ConnectionService } from './connectionService';
import { executeQuery, type QueryOptions } from './queryExecute';

export class QueryService extends Effect.Service<QueryService>()('QueryService', {
  accessors: true,
  dependencies: [ConnectionService.Default],
  effect: Effect.gen(function* () {
    const connectionService = yield* ConnectionService;

    const query = <A, I>(options: QueryOptions, recordSchema: Schema.Schema<A, I, never>) =>
      (isUndefined(options.orgId)
        ? connectionService.getConnection()
        : connectionService.getConnectionForOrg(options.orgId)
      ).pipe(
        Effect.flatMap(connection => executeQuery(connection, options, recordSchema)),
        Effect.withSpan('QueryService.query')
      );

    return { query };
  })
}) {
  public static query = <A, I>(options: QueryOptions, recordSchema: Schema.Schema<A, I, never>) =>
    Effect.flatMap(QueryService, service => service.query(options, recordSchema));
}
