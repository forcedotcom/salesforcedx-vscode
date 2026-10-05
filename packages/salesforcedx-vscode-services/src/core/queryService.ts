/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * SOQL over `ConnectionService`. `records` is a lazy `Stream` that follows
 * `nextRecordsUrl`. Caps are `Stream.take` at the caller. Pass `orgId` to query a
 * specific org; otherwise the default org connection is used. Pass `connection`
 * for a separately authenticated connection (e.g. an ISV debugger sid/url).
 */

import type { Connection } from '@salesforce/core';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as Schema from 'effect/Schema';
import { ConnectionService } from './connectionService';
import { executeQuery, type QueryOptions } from './queryExecute';

type QueryServiceOptions = QueryOptions &
  ({ readonly connection?: never } | { readonly connection: Connection; readonly orgId?: never });

export class QueryService extends Effect.Service<QueryService>()('QueryService', {
  accessors: true,
  dependencies: [ConnectionService.Default],
  effect: Effect.gen(function* () {
    const connectionService = yield* ConnectionService;

    const query = <A, I>(options: QueryServiceOptions, recordSchema: Schema.Schema<A, I, never>) =>
      Match.value(options).pipe(
        Match.when({ connection: Match.defined }, ({ connection }) => Effect.succeed(connection)),
        Match.when({ orgId: Match.defined }, ({ orgId }) => connectionService.getConnectionForOrg(orgId)),
        Match.orElse(() => connectionService.getConnection()),
        Effect.flatMap(connection => executeQuery(connection, options, recordSchema)),
        Effect.withSpan('QueryService.query')
      );

    return { query };
  })
}) {}
