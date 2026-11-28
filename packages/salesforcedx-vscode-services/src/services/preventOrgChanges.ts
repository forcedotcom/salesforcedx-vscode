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
  TargetOrgRef,
  orgIdFromConnection,
  type OrgId
} from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as PubSub from 'effect/PubSub';
import * as Scope from 'effect/Scope';
import * as Stream from 'effect/Stream';
import { runInterruptibleWorker } from './interruptibleWorker.js';

/** Subscribe before resolving auth; stop the entire command and join cleanup when its target changes. */
export const makePreventOrgChanges =
  (message: (orgId: OrgId) => string) =>
  <A, E, R>(command: Effect.Effect<A, E, R>) =>
    Effect.acquireUseRelease(
      Scope.make(),
      scope =>
        Effect.gen(function* () {
          const ref = yield* TargetOrgRef;
          const subscription = yield* PubSub.subscribe(ref.pubsub).pipe(Scope.provide(scope));
          // SubscriptionRef replays its initial snapshot; it predates the connection being resolved.
          yield* PubSub.take(subscription);
          const connection = yield* ConnectionService.use(service => service.getConnection());
          const expected = yield* Option.match(orgIdFromConnection(connection), {
            onNone: () => Effect.fail(new NoTargetOrgConfiguredError({ message: 'No target org configured' })),
            onSome: Effect.succeed
          });
          const changed = Stream.fromSubscription(subscription).pipe(
            Stream.map(org => org.orgId),
            Stream.changes,
            Stream.filter(orgId => orgId !== expected),
            Stream.runHead,
            Effect.flatMap(
              Option.match({
                onNone: () => Effect.never,
                onSome: observed =>
                  Effect.fail(
                    new InactiveOrgOperationError({
                      expectedOrgId: expected,
                      message: message(expected),
                      ...(observed ? { observedOrgId: observed } : {})
                    })
                  )
              })
            )
          );
          // Only subscription acquisition uses the private scope; work retains the caller's Scope/services.
          return yield* runInterruptibleWorker(command, changed);
        }),
      (scope, exit) => Scope.close(scope, exit)
    );
