/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { Connection } from '@salesforce/core';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Either from 'effect/Either';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { queryRecords } from '../effect/records';
import { ApexToolingMutationError } from '../effect/schema/errors';
import { DebugLevelId } from '../effect/schema/salesforceId';
import {
  createDebugLevel,
  createTraceFlag,
  extendTraceFlag,
  findDebugLevel,
  getTraceFlagForUser,
  updateDebugLevel
} from '../effect/traceFlags';
import { nls } from '../i18n';
import { DEFAULT_DEBUG_LEVEL_NAME, LOG_TIMER_LENGTH_MINUTES, LOG_TYPE } from '../logs/constants';
import { UserId } from '../schemas/salesforceId';
import { escapeXml } from './authUtil';

/** Unwrap outside the runtime so CLI errors do not acquire a FiberFailure prefix. */
const run = async <A, E extends { readonly message: string }>(operation: Effect.Effect<A, E>): Promise<A> =>
  operation.pipe(Effect.either, Effect.runPromise).then(Either.getOrThrowWith(error => new Error(error.message)));

const cliDebugLevels = { ApexCode: 'FINEST', Visualforce: 'FINER' } as const;
const cliDuration = Duration.minutes(LOG_TIMER_LENGTH_MINUTES);

const getDebugLevelId = async (connection: Connection, debugLevelName?: string): Promise<DebugLevelId> => {
  if (debugLevelName) {
    const debugLevelId = await run(findDebugLevel(connection, debugLevelName));
    if (Option.isNone(debugLevelId)) {
      throw new Error(nls.localize('trace_flags_failed_to_find_debug_level', debugLevelName));
    }
    return debugLevelId.value;
  }

  // CLI intentionally creates its default level; it does not reuse a same-named level.
  return run(
    createDebugLevel(connection, {
      DeveloperName: DEFAULT_DEBUG_LEVEL_NAME,
      MasterLabel: DEFAULT_DEBUG_LEVEL_NAME,
      ...cliDebugLevels
    }).pipe(
      Effect.catchTag('ApexToolingMutationError', error =>
        Effect.fail(
          new ApexToolingMutationError({
            operation: error.operation,
            message: nls.localize('trace_flags_failed_to_create_debug_level')
          })
        )
      )
    )
  );
};

const getUserIdOrThrow = async (connection: Connection, username: string): Promise<UserId> => {
  const escapedUsername = escapeXml(username);
  const [user] = await run(
    queryRecords({
      connection,
      operation: 'getTraceFlagUserId',
      soql: `SELECT Id FROM User WHERE username='${escapedUsername}'`,
      recordSchema: Schema.Struct({ Id: UserId })
    })
  );

  if (!user) {
    throw new Error(nls.localize('trace_flags_unknown_user'));
  }
  return user.Id;
};

/** CLI policy adapter; Tooling operations and expiration mechanics live in the Effect API. */
export const ensureTraceFlags = async (connection: Connection, debugLevelName?: string): Promise<boolean> => {
  const username = connection.getUsername();
  if (!username) {
    throw new Error(nls.localize('error_no_default_username'));
  }

  const userId = await getUserIdOrThrow(connection, username);
  const traceFlag = await run(getTraceFlagForUser(connection, userId, LOG_TYPE, 'CreatedDate'));
  if (Option.isSome(traceFlag)) {
    // Existing flags keep their level, even when the caller supplied a different name.
    return run(
      Schema.decodeUnknown(DebugLevelId)(traceFlag.value.DebugLevelId).pipe(
        Effect.flatMap(debugLevelId => updateDebugLevel(connection, debugLevelId, cliDebugLevels)),
        Effect.flatMap(() => extendTraceFlag(connection, traceFlag.value, cliDuration)),
        Effect.as(true),
        Effect.catchTag('ApexToolingMutationError', () => Effect.succeed(false))
      )
    );
  }

  return run(
    createTraceFlag(connection, userId, await getDebugLevelId(connection, debugLevelName), cliDuration, LOG_TYPE).pipe(
      Effect.as(true),
      Effect.catchTag('ApexToolingMutationError', () => Effect.succeed(false))
    )
  );
};
