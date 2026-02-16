/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import {
  DebugLevelCreateError,
  TraceFlagCreateError,
  TraceFlagNotFoundError,
  TraceFlagUpdateError,
  UserIdNotFoundError
} from '../errors/traceFlagErrors';
import { ConnectionService } from './connectionService';
import { getDefaultOrgRef } from './defaultOrgRef';
import { unknownToErrorCause } from './shared';

type TraceFlagRecord = {
  Id: string;
  LogType: string;
  DebugLevelId: string;
  StartDate?: string;
  ExpirationDate?: string;
  DebugLevel?: {
    ApexCode?: string;
    Visualforce?: string;
    DeveloperName?: string;
  };
  TracedEntityId?: string;
};

type DebugLevelRecord = {
  Id: string;
  DeveloperName?: string;
  ApexCode?: string;
  Visualforce?: string;
};

const APEX_CODE_DEBUG_LEVEL = 'FINEST';
const VISUALFORCE_DEBUG_LEVEL = 'FINER';
const REPLAY_DEBUGGER_LEVELS = 'ReplayDebuggerLevels';

const toToolingCreateTraceFlag = (
  userId: string,
  debugLevelId: string,
  expirationDate: Date
): Record<string, unknown> => ({
  TracedEntityId: userId,
  LogType: 'DEVELOPER_LOG',
  DebugLevelId: debugLevelId,
  StartDate: new Date().toISOString(),
  ExpirationDate: expirationDate.toISOString()
});

const calculateExpirationDate = (from: Date, duration = Duration.minutes(30)): Date =>
  new Date(from.getTime() + Duration.toMillis(duration));

const getUserIdOrFail = Effect.gen(function* () {
  const ref = yield* getDefaultOrgRef();
  const { userId } = yield* SubscriptionRef.get(ref);
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- yield* must be in statement position
  return userId
    ? userId
    : yield* Effect.fail(new UserIdNotFoundError({ message: 'Could not determine user ID for trace flag' }));
});

export class TraceFlagService extends Effect.Service<TraceFlagService>()('TraceFlagService', {
  accessors: true,
  dependencies: [ConnectionService.Default],
  effect: Effect.gen(function* () {
    const connectionService = yield* ConnectionService;

    const getTraceFlags = Effect.fn('TraceFlagService.getTraceFlags')(function* () {
      const conn = yield* connectionService.getConnection();
      const userId = yield* getUserIdOrFail;
      const query = `SELECT Id, LogType, StartDate, ExpirationDate, DebugLevelId, DebugLevel.ApexCode, DebugLevel.Visualforce, DebugLevel.DeveloperName, TracedEntityId
        FROM TraceFlag
        WHERE LogType='DEVELOPER_LOG' AND TracedEntityId='${userId}'`;
      return yield* Effect.tryPromise({
        try: () => conn.tooling.query<TraceFlagRecord>(query),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new TraceFlagNotFoundError({ message: `Failed to query trace flags: ${cause.message}` });
        }
      });
    });

    const getTraceFlagForUser = Effect.fn('TraceFlagService.getTraceFlagForUser')(function* (userId: string) {
      const conn = yield* connectionService.getConnection();
      const query = `SELECT Id, LogType, StartDate, ExpirationDate, DebugLevelId, DebugLevel.ApexCode, DebugLevel.Visualforce, DebugLevel.DeveloperName
        FROM TraceFlag
        WHERE LogType='DEVELOPER_LOG' AND TracedEntityId='${userId}' AND DebugLevel.DeveloperName='${REPLAY_DEBUGGER_LEVELS}'`;
      const result = yield* Effect.tryPromise({
        try: () => conn.tooling.query<TraceFlagRecord>(query),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new TraceFlagNotFoundError({ message: `Failed to query trace flag: ${cause.message}` });
        }
      });
      return result.totalSize > 0 ? Option.some(result.records[0]) : Option.none();
    });

    const getOrCreateDebugLevel = Effect.fn('TraceFlagService.getOrCreateDebugLevel')(function* () {
      const conn = yield* connectionService.getConnection();
      const existing = yield* Effect.tryPromise({
        try: () =>
          conn.tooling.query<DebugLevelRecord>(
            `SELECT Id FROM DebugLevel WHERE DeveloperName = '${REPLAY_DEBUGGER_LEVELS}' LIMIT 1`
          ),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new DebugLevelCreateError({ message: `Failed to query debug level: ${cause.message}` });
        }
      });
      if (existing.records.length > 0 && existing.records[0].Id) {
        return existing.records[0].Id;
      }
      const createResult = yield* Effect.tryPromise({
        try: () =>
          conn.tooling.create('DebugLevel', {
            DeveloperName: REPLAY_DEBUGGER_LEVELS,
            MasterLabel: REPLAY_DEBUGGER_LEVELS,
            ApexCode: APEX_CODE_DEBUG_LEVEL,
            Visualforce: VISUALFORCE_DEBUG_LEVEL
          }),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new DebugLevelCreateError({
            message: `Failed to create debug level: ${cause.message}`,
            cause: error
          });
        }
      });
      return createResult.success && createResult.id
        ? createResult.id
        : yield* Effect.fail(new DebugLevelCreateError({ message: 'Debug level create returned no ID' }));
    });

    const createTraceFlag = Effect.fn('TraceFlagService.createTraceFlag')(function* (
      userId: string,
      debugLevelId: string,
      duration = Duration.minutes(30)
    ) {
      const conn = yield* connectionService.getConnection();
      const expirationDate = calculateExpirationDate(new Date(), duration);
      const result = yield* Effect.tryPromise({
        try: () => conn.tooling.create('TraceFlag', toToolingCreateTraceFlag(userId, debugLevelId, expirationDate)),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new TraceFlagCreateError({
            message: `Failed to create trace flag: ${cause.message}`,
            cause: error
          });
        }
      });
      return result.success && result.id ? result.id : undefined;
    });

    const updateTraceFlag = Effect.fn('TraceFlagService.updateTraceFlag')(function* (
      traceFlagId: string,
      options?: { debugLevelId?: string; expirationDate?: Date }
    ) {
      const conn = yield* connectionService.getConnection();
      const payload: { Id: string; StartDate: string; ExpirationDate?: string } = {
        Id: traceFlagId,
        StartDate: new Date().toISOString()
      };
      if (options?.expirationDate) {
        payload.ExpirationDate = options.expirationDate.toISOString();
      }
      if (options?.debugLevelId) {
        const dlId = options.debugLevelId;
        yield* Effect.tryPromise({
          try: () =>
            conn.tooling.update('DebugLevel', {
              Id: dlId,
              ApexCode: APEX_CODE_DEBUG_LEVEL,
              Visualforce: VISUALFORCE_DEBUG_LEVEL
            }),
          catch: error => {
            const { cause } = unknownToErrorCause(error);
            return new TraceFlagUpdateError({
              message: `Failed to update debug level: ${cause.message}`,
              cause: error
            });
          }
        });
      }
      return yield* Effect.tryPromise({
        try: () => conn.tooling.update('TraceFlag', payload),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new TraceFlagUpdateError({
            message: `Failed to update trace flag: ${cause.message}`,
            cause: error
          });
        }
      });
    });

    const deleteTraceFlag = Effect.fn('TraceFlagService.deleteTraceFlag')(function* (traceFlagId: string) {
      const conn = yield* connectionService.getConnection();
      return yield* Effect.tryPromise({
        try: () => conn.tooling.delete('TraceFlag', traceFlagId),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new TraceFlagUpdateError({
            message: `Failed to delete trace flag: ${cause.message}`,
            cause: error
          });
        }
      });
    });

    const ensureTraceFlag = Effect.fn('TraceFlagService.ensureTraceFlag')(function* (duration = Duration.minutes(30)) {
      const userId = yield* getUserIdOrFail;
      const existing = yield* getTraceFlagForUser(userId);

      return yield* Option.match(existing, {
        onNone: () =>
          Effect.gen(function* () {
            const debugLevelId = yield* getOrCreateDebugLevel();
            const traceFlagId = yield* createTraceFlag(userId, debugLevelId, duration);
            if (!traceFlagId) {
              return yield* Effect.fail(new TraceFlagCreateError({ message: 'Create returned no ID' }));
            }
            return { created: true, traceFlagId };
          }),
        onSome: traceFlag =>
          Effect.gen(function* () {
            const expirationDate = traceFlag.ExpirationDate ? new Date(traceFlag.ExpirationDate) : new Date();
            const validExpiration =
              expirationDate.getTime() - Date.now() > Duration.toMillis(duration)
                ? expirationDate
                : calculateExpirationDate(new Date(), duration);
            yield* updateTraceFlag(traceFlag.Id, {
              debugLevelId: traceFlag.DebugLevelId,
              expirationDate: validExpiration
            });
            return { created: false, traceFlagId: traceFlag.Id };
          })
      });
    });

    const cleanupExpired = Effect.fn('TraceFlagService.cleanupExpired')(function* () {
      const userId = yield* getUserIdOrFail;
      const existing = yield* getTraceFlagForUser(userId);
      return yield* Option.match(existing, {
        onNone: () => Effect.succeed(false),
        onSome: tf =>
          new Date(tf.ExpirationDate ?? 0) < new Date()
            ? deleteTraceFlag(tf.Id).pipe(Effect.as(true))
            : Effect.succeed(false)
      });
    });

    const getUserId = Effect.fn('TraceFlagService.getUserId')(function* () {
      return yield* getUserIdOrFail;
    });

    return {
      getTraceFlags,
      getTraceFlagForUser,
      createTraceFlag,
      updateTraceFlag,
      deleteTraceFlag,
      ensureTraceFlag,
      cleanupExpired,
      getOrCreateDebugLevel,
      getUserId
    };
  })
}) {}
