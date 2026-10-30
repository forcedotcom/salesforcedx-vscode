/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ConnectionService,
  InactiveOrgOperationError,
  NoTargetOrgConfiguredError,
  QueryService,
  authFieldsFromConnection,
  orgIdFromConnection,
  type QueryOptions
} from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import type * as Schema from 'effect/Schema';
import { ConnectionHost } from './connectionHost.js';
import { executeQuery } from './queryExecute.js';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';
import { OrgChanges } from './targetOrgRef.js';

export const QueryServiceLayer = Layer.effect(
  QueryService,
  Effect.gen(function* () {
    const connections = yield* ConnectionService;
    const changes = yield* OrgChanges;
    const operations = yield* ServiceOperations;
    const host = yield* ConnectionHost;
    const query = Effect.fn('QueryService.query')(function* <S extends Schema.Constraint>(
      options: QueryOptions,
      recordSchema: S
    ) {
      const connection = yield* options.orgId
        ? connections.getConnectionForOrg(options.orgId)
        : connections.getConnection();
      const orgId = options.orgId ?? Option.getOrUndefined(orgIdFromConnection(connection));
      if (!orgId)
        return yield* new NoTargetOrgConfiguredError({ message: 'No active org identity is available for query' });
      const expected = yield* changes.snapshot;
      const username =
        connection.getUsername() ??
        Option.getOrUndefined(Option.flatMap(authFieldsFromConnection(connection), fields => fields.username));
      const changed = new InactiveOrgOperationError({ expectedOrgId: orgId, message: host.messages.orgChanged(orgId) });
      if (expected.org.orgId !== orgId || expected.org.username?.toLowerCase() !== username?.toLowerCase()) {
        return yield* new InactiveOrgOperationError({
          expectedOrgId: orgId,
          message: changed.message,
          ...(expected.org.orgId ? { observedOrgId: expected.org.orgId } : {})
        });
      }
      const validate = changes.commitIfCurrent(expected.orgGeneration, changed, Effect.void);
      // Never hold the org commit semaphore during network or schema decoding.
      const runPage = <A, E, R>(page: Effect.Effect<A, E, R>): Effect.Effect<A, E | InactiveOrgOperationError, R> =>
        operations.run(
          validate.pipe(
            Effect.andThen(page),
            Effect.tap(() => validate)
          )
        );
      return yield* executeQuery<S, InactiveOrgOperationError>(connection, options, recordSchema, runPage);
    }, operations.run);
    return QueryService.of({ query });
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));
