/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Cache from 'effect/Cache';
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

const APEX_CODE_DEBUG_LEVEL = 'FINEST';
const VISUALFORCE_DEBUG_LEVEL = 'FINER';

/** DebugLevel.DeveloperName used for replay-debugger trace flags. Created on demand via getOrCreateDebugLevel. */
const REPLAY_DEBUGGER_LEVELS = 'ReplayDebuggerLevels';

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
  return userId ? userId : yield* new UserIdNotFoundError({ message: 'Could not determine user ID for trace flag' });
});

export class TraceFlagService extends Effect.Service<TraceFlagService>()('TraceFlagService', {
  accessors: true,
  dependencies: [ConnectionService.Default],
  effect: Effect.gen(function* () {
    const connectionService = yield* ConnectionService;
    const traceFlagsChanged = yield* PubSub.sliding<TraceFlagItem[]>(1);

    // Id -> Name cache for User/ApexClass/ApexTrigger entities referenced by trace flags.
    // External-set mode: getOption for reads, set after batch SOQL. Misses are not cached.
    const idNameCache = yield* Cache.make<string, string>({
      capacity: 1000,
      timeToLive: Duration.infinity,
      lookup: () => Effect.die('idNameCache.lookup should never be called — use getOption + set')
    });

    // Invalidate cache when default org identity (orgId/username) changes.
    yield* Effect.forkDaemon(
      getDefaultOrgRef().pipe(
        Effect.flatMap(ref =>
          ref.changes.pipe(
            Stream.map(info => `${info.orgId ?? ''}|${info.username ?? ''}`),
            Stream.changes,
            Stream.drop(1),
            Stream.runForEach(() => idNameCache.invalidateAll)
          )
        )
      )
    );

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
      const queryIdName = (soql: string, tooling: boolean) =>
        Effect.tryPromise(() =>
          tooling
            ? conn.tooling.query<{ Id: string; Name: string }>(soql)
            : conn.query<{ Id: string; Name: string }>(soql)
        ).pipe(Effect.map(r => r.records));

      // Identify cache misses; group by prefix for batched SOQL.
      const missesByPrefix = Object.groupBy(
        (yield* Effect.all(
          entitiesToResolve.map(id => idNameCache.contains(id).pipe(Effect.map(hit => [id, hit] as const))),
          { concurrency: 'unbounded' }
        )).flatMap(([id, hit]) => (hit ? [] : [id])),
        id => id.slice(0, 3)
      );

      // Query only the misses, per prefix; populate cache as rows arrive.
      yield* Stream.fromIterable(
        Object.entries(missesByPrefix).filter((entry): entry is [string, string[]] => entry[1] !== undefined)
      ).pipe(
        Stream.mapConcatEffect(([prefix, ids]) =>
          Match.value(prefix).pipe(
            Match.when('005', () =>
              queryIdName(`SELECT Id, Name FROM User WHERE Id IN (${idListToInClause(ids)})`, false)
            ),
            Match.when('01p', () =>
              queryIdName(`SELECT Id, Name FROM ApexClass WHERE Id IN (${idListToInClause(ids)})`, true)
            ),
            Match.when('01q', () =>
              queryIdName(`SELECT Id, Name FROM ApexTrigger WHERE Id IN (${idListToInClause(ids)})`, true)
            ),
            Match.orElse(() => Effect.succeed([]))
          )
        ),
        Stream.mapEffect(result =>
          Schema.decodeUnknown(Schema.Struct({ Id: Schema.String, Name: Schema.String }))(result).pipe(
            Effect.tapError(e => Effect.logWarning('traceFlagService: skipping undecodable query result', e)),
            Effect.option
          )
        ),
        Stream.filterMap(o => o),
        Stream.runForEach(row => idNameCache.set(row.Id, row.Name))
      );

      // Cache is the single source of truth — read each record's name directly. Misses stay undefined.
      return yield* Effect.all(
        traceFlagRecords.map(rec =>
          (rec.TracedEntityId
            ? idNameCache
                .getOption(rec.TracedEntityId)
                .pipe(Effect.map(opt => ({ ...rec, TracedEntityName: Option.getOrUndefined(opt) })))
            : Effect.succeed(rec)
          ).pipe(Effect.flatMap(r => Schema.decodeUnknown(TraceFlagItemSchema)(r)))
        ),
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
        WHERE LogType='${logType}' AND TracedEntityId='${userId}'
        ORDER BY ExpirationDate DESC LIMIT 1`;
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
      return result.success && result.id
        ? result.id
        : yield* new TraceFlagCreateError({ message: 'Trace flag create returned no ID' });
    });

    const updateTraceFlag = Effect.fn('TraceFlagService.updateTraceFlag')(function* (
      traceFlagId: string,
      options?: { debugLevelId?: string; expirationDate?: Date }
    ) {
      const conn = yield* connectionService.getConnection();
      const payload = {
        Id: traceFlagId,
        StartDate: new Date().toISOString(),
        ...(options?.expirationDate ? { ExpirationDate: options.expirationDate.toISOString() } : {})
      };
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
      const debugLevelId = existingDebugLevelId ?? (yield* getOrCreateDebugLevel());
      const existing = yield* getTraceFlagForUser(userId, logType);

      return yield* Option.match(existing, {
        onNone: () =>
          Effect.gen(function* () {
            const traceFlagId = yield* createTraceFlag(userId, debugLevelId, duration, logType);
            return { created: true, traceFlagId };
          }),
        onSome: traceFlag =>
          Effect.gen(function* () {
            if (traceFlag.expirationDate < new Date()) {
              yield* deleteTraceFlag(traceFlag.id);
              const traceFlagId = yield* createTraceFlag(userId, debugLevelId, duration, logType);
              return { created: true, traceFlagId };
            }
            const validExpiration =
              traceFlag.expirationDate.getTime() - Date.now() > Duration.toMillis(duration)
                ? traceFlag.expirationDate
                : calculateExpirationDate(new Date(), duration);
            if (debugLevelId !== traceFlag.debugLevelId) {
              yield* changeTraceFlagDebugLevel(traceFlag.id, debugLevelId);
            }
            if (validExpiration.getTime() !== traceFlag.expirationDate.getTime()) {
              yield* updateTraceFlag(traceFlag.id, { expirationDate: validExpiration });
            }
            return { created: false, traceFlagId: traceFlag.id };
          })
      });
    });

    const cleanupExpired = Effect.fn('TraceFlagService.cleanupExpired')(() =>
      getUserIdOrFail.pipe(
        Effect.flatMap(getTraceFlagForUser),
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.succeed(false),
            onSome: tf =>
              tf.expirationDate < new Date() ? deleteTraceFlag(tf.id).pipe(Effect.as(true)) : Effect.succeed(false)
          })
        )
      )
    );

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
