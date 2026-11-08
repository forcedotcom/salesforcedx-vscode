/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { IdRecord } from './types';
import type { Connection } from '@salesforce/core';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Either from 'effect/Either';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { ApexToolingMutationError } from '../effect/schema/errors';
import { SalesforceId } from '../effect/schema/salesforceId';
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
import { escapeXml } from './authUtil';
import { elapsedTime } from './elapsedTime';

/** Unwrap outside the runtime so CLI errors do not acquire a FiberFailure prefix. */
const run = async <A, E extends { readonly message: string }>(operation: Effect.Effect<A, E>): Promise<A> =>
  operation.pipe(Effect.either, Effect.runPromise).then(Either.getOrThrowWith(error => new Error(error.message)));

const cliDebugLevels = { ApexCode: 'FINEST', Visualforce: 'FINER' } as const;
const cliDuration = Duration.minutes(LOG_TIMER_LENGTH_MINUTES);

/** CLI policy adapter; Tooling operations and expiration mechanics live in the Effect API. */
export class TraceFlags {
  constructor(private readonly connection: Connection) {}

  @elapsedTime()
  public async ensureTraceFlags(debugLevelName?: string): Promise<boolean> {
    const username = this.connection.getUsername();
    if (!username) {
      throw new Error(nls.localize('error_no_default_username'));
    }

    const userId = await this.getUserIdOrThrow(username);
    const traceFlag = await run(getTraceFlagForUser(this.connection, userId, LOG_TYPE, 'CreatedDate'));
    if (Option.isSome(traceFlag)) {
      // Existing flags keep their level, even when the caller supplied a different name.
      return run(
        Schema.decodeUnknown(SalesforceId)(traceFlag.value.DebugLevelId).pipe(
          Effect.flatMap(debugLevelId => updateDebugLevel(this.connection, debugLevelId, cliDebugLevels)),
          Effect.flatMap(() => extendTraceFlag(this.connection, traceFlag.value, cliDuration)),
          Effect.as(true),
          Effect.catchTag('ApexToolingMutationError', () => Effect.succeed(false))
        )
      );
    }

    return run(
      createTraceFlag(this.connection, userId, await this.getDebugLevelId(debugLevelName), cliDuration, LOG_TYPE).pipe(
        Effect.as(true),
        Effect.catchTag('ApexToolingMutationError', () => Effect.succeed(false))
      )
    );
  }

  @elapsedTime()
  private async getDebugLevelId(debugLevelName?: string): Promise<SalesforceId> {
    if (debugLevelName) {
      const debugLevelId = await run(findDebugLevel(this.connection, debugLevelName));
      if (Option.isNone(debugLevelId)) {
        throw new Error(nls.localize('trace_flags_failed_to_find_debug_level', debugLevelName));
      }
      return debugLevelId.value;
    }

    // CLI intentionally creates its default level; it does not reuse a same-named level.
    return run(
      createDebugLevel(this.connection, {
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
  }

  @elapsedTime()
  private async getUserIdOrThrow(username: string): Promise<SalesforceId> {
    const escapedUsername = escapeXml(username);
    const userQuery = `SELECT Id FROM User WHERE username='${escapedUsername}'`;
    const userResult = await this.connection.query<IdRecord>(userQuery);

    if (userResult.totalSize === 0) {
      throw new Error(nls.localize('trace_flags_unknown_user'));
    }
    return run(Schema.decodeUnknown(SalesforceId)(userResult.records[0].Id));
  }
}
