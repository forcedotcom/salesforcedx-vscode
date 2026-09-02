/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { isNotUndefined } from 'effect/Predicate';
import * as Sink from 'effect/Sink';
import * as Stream from 'effect/Stream';
import { nls } from '../messages';
import { ConnectionService, InactiveOrgOperationError, NoTargetOrgConfiguredError } from './connectionService';
import { getDefaultOrgRef } from './defaultOrgRef';

/** Prevent a command from continuing after its target org changes. */
export const preventOrgChanges = <A, E, R>(command: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    const targetOrgRef = yield* getDefaultOrgRef();
    // Subscribe before resolving the connection so no target-org update can occur between the snapshot and stream.
    const [, changes] = yield* targetOrgRef.changes.pipe(Stream.peel(Sink.head()));
    const expectedOrgId = yield* ConnectionService.getConnection().pipe(
      Effect.map(connection => connection.getAuthInfoFields().orgId),
      Effect.filterOrFail(isNotUndefined, () => new NoTargetOrgConfiguredError({ message: 'No target org configured' }))
    );

    const targetOrgChanged = changes.pipe(
      Stream.map(org => org.orgId),
      Stream.changes,
      Stream.filter(orgId => orgId !== expectedOrgId),
      Stream.runHead,
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.never,
          onSome: observedOrgId =>
            Effect.fail(
              new InactiveOrgOperationError({
                message: nls.localize('org_operation_target_changed', expectedOrgId),
                expectedOrgId,
                ...(observedOrgId ? { observedOrgId } : {})
              })
            )
        })
      )
    );

    return yield* Effect.raceFirst(command, targetOrgChanged);
  }).pipe(Effect.scoped);
