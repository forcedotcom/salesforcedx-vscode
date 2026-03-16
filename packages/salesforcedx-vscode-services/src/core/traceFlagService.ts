/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as Option from 'effect/Option';
import * as ParseResult from 'effect/ParseResult';
import { isString } from 'effect/Predicate';
import * as PubSub from 'effect/PubSub';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
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
import {
  DebugLevelItemSchema,
  TraceFlagItemSchema,
  ToolingDebugLevelStruct,
  type ToolingDebugLevelRecord,
  type ToolingTraceFlagRecord,
  type TraceFlagItem,
  type TraceFlagLogType
} from './schemas/traceFlagSchemas';
import { unknownToErrorCause } from './shared';

export { DebugLevelItemSchema, TraceFlagItemStruct, TraceFlagLogType } from './schemas/traceFlagSchemas';
export type { DebugLevelItem, TraceFlagItem } from './schemas/traceFlagSchemas';

const APEX_CODE_DEBUG_LEVEL = 'FINEST';
const VISUALFORCE_DEBUG_LEVEL = 'FINER';

/** DebugLevel.DeveloperName used for replay-debugger trace flags. Created on demand via getOrCreateDebugLevel. */
export const REPLAY_DEBUGGER_LEVELS = 'ReplayDebuggerLevels';

const toToolingCreateTraceFlag = (
  userId: string,
  debugLevelId: string,
  expirationDate: Date,
  logType: TraceFlagLogType = 'DEVELOPER_LOG'
): Record<string, unknown> => ({
  TracedEntityId: userId,
  LogType: logType,
  DebugLevelId: debugLevelId,
  StartDate: new Date().toISOString(),
  ExpirationDate: expirationDate.toISOString()
});

const calculateExpirationDate = (from: Date, duration = Duration.minutes(30)): Date =>
  new Date(from.getTime() + Duration.toMillis(duration));

const idListToInClause = (ids: string[]) => ids.map(id => `'${id}'`).join(',');

const getUserIdOrFail = Effect.gen(function* () {
  const ref = yield* getDefaultOrgRef();
  const { userId } = yield* SubscriptionRef.get(ref);
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- yield* must be in statement position
  return userId
    ? userId
    : yield* new UserIdNotFoundError({ message: 'Could not determine user ID for trace flag' });
});

export class TraceFlagService extends Effect.Service<TraceFlagService>()('TraceFlagService', {
  accessors: true,
  dependencies: [ConnectionService.Default],
  effect: Effect.gen(function* () {
    const connectionService = yield* ConnectionService;
    const traceFlagsChanged = yield* PubSub.sliding<TraceFlagItem[]>(1);

    const getTraceFlags = Effect.fn('TraceFlagService.getTraceFlags')(function* () {
      const conn = yield* connectionService.getConnection();
      const query = `SELECT Id, LogType, StartDate, ExpirationDate, DebugLevelId, DebugLevel.ApexCode, DebugLevel.Visualforce, DebugLevel.DeveloperName, TracedEntityId
        FROM TraceFlag`;
      const traceFlagRecords = (yield* Effect.tryPromise({
        try: () => conn.tooling.query<ToolingTraceFlagRecord>(query),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new TraceFlagNotFoundError({ message: `Failed to query trace flags: ${cause.message}` });
        }
      })).records;
      const entitiesToResolve = [...new Set(traceFlagRecords.map(r => r.TracedEntityId).filter(isString))];

      if (entitiesToResolve.length === 0) {
        return yield* Effect.all(
          traceFlagRecords.map(r => Schema.decodeUnknown(TraceFlagItemSchema)(r)),
          { concurrency: 'unbounded' }
        );
      }
      const byPrefix = Object.groupBy(entitiesToResolve, id => id.slice(0, 3));

      const queryIdName = (soql: string, tooling: boolean) =>
        Effect.tryPromise(() =>
          tooling ? conn.tooling.query<{ Id: string; Name: string }>(soql) : conn.query<{ Id: string; Name: string }>(soql)
        ).pipe(Effect.map(r => r.records));
      // get the names for these IDs
      const idToName = yield* Stream.fromIterable(
        Object.entries(byPrefix).filter((entry): entry is [string, string[]] => entry[1] !== undefined)
      ).pipe(
        Stream.flatMap(([prefix, ids]) =>
          Match.value(prefix).pipe(
            Match.when(
              '005',
              () => queryIdName(`SELECT Id, Name FROM User WHERE Id IN (${idListToInClause(ids)})`, false)
            ),
            Match.when(
              '01p',
              () => queryIdName(`SELECT Id, Name FROM ApexClass WHERE Id IN (${idListToInClause(ids)})`, true)
            ),
            Match.when(
              '01q',
              () => queryIdName(`SELECT Id, Name FROM ApexTrigger WHERE Id IN (${idListToInClause(ids)})`, true)
            ),
            Match.orElse(() => Effect.succeed([]))
          )
        ),
        Stream.mapEffect(result =>
          Schema.decodeUnknown(Schema.Array(Schema.Struct({ Id: Schema.String, Name: Schema.String })))(result)
        ),
        Stream.flatMap(Stream.fromIterable),
        Stream.runFold(new Map<string, string>(), (map, row) => map.set(row.Id, row.Name))
      );

      return yield* Effect.all(
        traceFlagRecords
          .map(rec => (rec.TracedEntityId ? { ...rec, TracedEntityName: idToName.get(rec.TracedEntityId) } : rec))
          .map(r => Schema.decodeUnknown(TraceFlagItemSchema)(r)),
        { concurrency: 'unbounded' }
      ).pipe(
        Effect.mapError((parseError: ParseResult.ParseError) => {
          const msg = ParseResult.TreeFormatter.formatErrorSync(parseError);
          return new TraceFlagNotFoundError({ message: `Failed to decode trace flag records: ${msg}` });
        })
      );
    });

    const getDebugLevels = Effect.fn('TraceFlagService.getDebugLevels')(function* () {
      const conn = yield* connectionService.getConnection();
      const query = `SELECT ${Object.keys(ToolingDebugLevelStruct.fields).join(', ')} FROM DebugLevel`;
      const result = yield* Effect.tryPromise({
        try: () => conn.tooling.query<ToolingDebugLevelRecord>(query),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new TraceFlagNotFoundError({ message: `Failed to query debug levels: ${cause.message}` });
        }
      });
      return yield* Effect.all(
        result.records.map(r => Schema.decodeUnknown(DebugLevelItemSchema)(r)),
        { concurrency: 'unbounded' }
      ).pipe(
        Effect.mapError((parseError: ParseResult.ParseError) => {
          const msg = ParseResult.TreeFormatter.formatErrorSync(parseError);
          return new TraceFlagNotFoundError({ message: `Failed to decode debug level records: ${msg}` });
        })
      );
    });

    const getTraceFlagForUser = Effect.fn('TraceFlagService.getTraceFlagForUser')(function* (
      userId: string,
      logType: TraceFlagLogType = 'DEVELOPER_LOG'
    ) {
      const conn = yield* connectionService.getConnection();
      const query = `SELECT Id, LogType, StartDate, ExpirationDate, DebugLevelId, DebugLevel.ApexCode, DebugLevel.Visualforce, DebugLevel.DeveloperName
        FROM TraceFlag
        WHERE LogType='${logType}' AND TracedEntityId='${userId}' AND DebugLevel.DeveloperName='${REPLAY_DEBUGGER_LEVELS}'`;
      const result = yield* Effect.tryPromise({
        try: () => conn.tooling.query<ToolingTraceFlagRecord>(query),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new TraceFlagNotFoundError({ message: `Failed to query trace flag: ${cause.message}` });
        }
      });
      if (result.totalSize === 0) return Option.none();
      const item = yield* Schema.decodeUnknown(TraceFlagItemSchema)(result.records[0]).pipe(
        Effect.mapError((parseError: ParseResult.ParseError) => {
          const msg = ParseResult.TreeFormatter.formatErrorSync(parseError);
          return new TraceFlagNotFoundError({ message: `Failed to decode trace flag: ${msg}` });
        })
      );
      return Option.some(item);
    });

    const getOrCreateDebugLevel = Effect.fn('TraceFlagService.getOrCreateDebugLevel')(function* () {
      const conn = yield* connectionService.getConnection();
      const existing = yield* Effect.tryPromise({
        try: () =>
          conn.tooling.query<{ Id: string }>(
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
        : yield* new DebugLevelCreateError({ message: 'Debug level create returned no ID' });
    });

    const createTraceFlag = Effect.fn('TraceFlagService.createTraceFlag')(function* (
      userId: string,
      debugLevelId: string,
      duration = Duration.minutes(30),
      logType: TraceFlagLogType = 'DEVELOPER_LOG'
    ) {
      const conn = yield* connectionService.getConnection();
      const expirationDate = calculateExpirationDate(new Date(), duration);
      const result = yield* Effect.tryPromise({
        try: () =>
          conn.tooling.create('TraceFlag', toToolingCreateTraceFlag(userId, debugLevelId, expirationDate, logType)),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new TraceFlagCreateError({
            message: `Failed to create trace flag: ${cause.message}`,
            cause: error
          });
        }
      });
      const flags = yield* getTraceFlags().pipe(Effect.catchAll(() => Effect.succeed([])));
      yield* PubSub.publish(traceFlagsChanged, flags);
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
      yield* Effect.tryPromise({
        try: () => conn.tooling.update('TraceFlag', payload),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new TraceFlagUpdateError({
            message: `Failed to update trace flag: ${cause.message}`,
            cause: error
          });
        }
      });
      const flags = yield* getTraceFlags().pipe(Effect.catchAll(() => Effect.succeed([])));
      yield* PubSub.publish(traceFlagsChanged, flags);
    });

    const deleteTraceFlag = Effect.fn('TraceFlagService.deleteTraceFlag')(function* (traceFlagId: string) {
      const conn = yield* connectionService.getConnection();
      yield* Effect.tryPromise({
        try: () => conn.tooling.delete('TraceFlag', traceFlagId),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new TraceFlagUpdateError({
            message: `Failed to delete trace flag: ${cause.message}`,
            cause: error
          });
        }
      });
      const flags = yield* getTraceFlags().pipe(Effect.catchAll(() => Effect.succeed([])));
      yield* PubSub.publish(traceFlagsChanged, flags);
    });

    const changeTraceFlagDebugLevel = Effect.fn('TraceFlagService.changeTraceFlagDebugLevel')(function* (
      traceFlagId: string,
      newDebugLevelId: string
    ) {
      const conn = yield* connectionService.getConnection();
      yield* Effect.tryPromise({
        try: () =>
          conn.tooling.update('TraceFlag', {
            Id: traceFlagId,
            DebugLevelId: newDebugLevelId
          }),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new TraceFlagUpdateError({
            message: `Failed to change trace flag debug level: ${cause.message}`,
            cause: error
          });
        }
      });
      const flags = yield* getTraceFlags().pipe(Effect.catchAll(() => Effect.succeed([])));
      yield* PubSub.publish(traceFlagsChanged, flags);
    });

    const ensureTraceFlag = Effect.fn('TraceFlagService.ensureTraceFlag')(function* (
      userId: string,
      duration = Duration.minutes(30),
      logType: TraceFlagLogType = 'DEVELOPER_LOG',
      existingDebugLevelId?: string
    ) {
      const existing = yield* getTraceFlagForUser(userId, logType);

      return yield* Option.match(existing, {
        onNone: () =>
          Effect.gen(function* () {
            const debugLevelId = existingDebugLevelId ?? (yield* getOrCreateDebugLevel());
            const traceFlagId = yield* createTraceFlag(userId, debugLevelId, duration, logType);
            if (!traceFlagId) {
              return yield* new TraceFlagCreateError({ message: 'Create returned no ID' });
            }
            return { created: true, traceFlagId };
          }),
        onSome: traceFlag =>
          Effect.gen(function* () {
            const expirationDate = traceFlag.expirationDate;
            const validExpiration =
              expirationDate.getTime() - Date.now() > Duration.toMillis(duration)
                ? expirationDate
                : calculateExpirationDate(new Date(), duration);
            yield* updateTraceFlag(traceFlag.id, {
              debugLevelId: traceFlag.debugLevelId,
              expirationDate: validExpiration
            });
            return { created: false, traceFlagId: traceFlag.id };
          })
      });
    });

    const cleanupExpired = Effect.fn('TraceFlagService.cleanupExpired')(function* () {
      const userId = yield* getUserIdOrFail;
      const existing = yield* getTraceFlagForUser(userId);
      return yield* Option.match(existing, {
        onNone: () => Effect.succeed(false),
        onSome: tf =>
          tf.expirationDate < new Date() ? deleteTraceFlag(tf.id).pipe(Effect.as(true)) : Effect.succeed(false)
      });
    });

    const getUserId = Effect.fn('TraceFlagService.getUserId')(function* () {
      return yield* getUserIdOrFail;
    });

    return {
      getTraceFlags,
      getDebugLevels,
      getTraceFlagForUser,
      createTraceFlag,
      updateTraceFlag,
      deleteTraceFlag,
      changeTraceFlagDebugLevel,
      ensureTraceFlag,
      cleanupExpired,
      getOrCreateDebugLevel,
      getUserId,
      traceFlagsChanged
    };
  })
}) {}
