/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Cache from 'effect/Cache';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
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

/** Adaptive cache TTL ladder: 30s → 60s → 120s → 5min (capped). 4 steps by design. Failures not cached. @W-22390896 */
export const ADAPTIVE_TTL_SEQUENCE_MS = [30_000, 60_000, 120_000, 300_000] as const;
export const adaptiveTtl = (consecutiveNoChange: number): Duration.Duration =>
  Duration.millis(ADAPTIVE_TTL_SEQUENCE_MS[Math.min(consecutiveNoChange, ADAPTIVE_TTL_SEQUENCE_MS.length - 1)]);

/** Order-independent identity hash on id|expiration|debugLevel|active — SOQL reorderings don't reset TTL. */
const tfHash = (tf: TraceFlagItem): string =>
  `${tf.id}|${tf.expirationDate.getTime()}|${tf.debugLevelId ?? ''}|${tf.isActive ? 1 : 0}`;
export const tfArrayHash = (arr: readonly TraceFlagItem[]): string => arr.map(tfHash).toSorted().join(';');
export const tfOptionHash = (o: Option.Option<TraceFlagItem>): string => (Option.isSome(o) ? tfHash(o.value) : '');

/** `prior === undefined` ⇒ no prior yet ⇒ never same (counter starts fresh at 0). */
export const isSameTfArray = (prior: readonly TraceFlagItem[] | undefined, fresh: readonly TraceFlagItem[]): boolean =>
  prior !== undefined && tfArrayHash(prior) === tfArrayHash(fresh);
export const isSameTfOption = (
  prior: Option.Option<TraceFlagItem> | undefined,
  fresh: Option.Option<TraceFlagItem>
): boolean => prior !== undefined && tfOptionHash(prior) === tfOptionHash(fresh);

type AdaptiveCacheState<T> = { lastResult: T; consecutiveNoChange: number };

/** Counter+TTL evolution: same result → counter += 1; otherwise → counter = 0. Exported for unit tests. */
export const computeAdaptiveTtl = <T>(
  prior: { lastResult: T; consecutiveNoChange: number } | undefined,
  fresh: T,
  isSame: (prior: T | undefined, fresh: T) => boolean
): { newCount: number; ttl: Duration.Duration } => {
  const same = isSame(prior?.lastResult, fresh);
  const newCount = same && prior ? prior.consecutiveNoChange + 1 : 0;
  return { newCount, ttl: adaptiveTtl(newCount) };
};

/** Narrow a string to TraceFlagLogType without using `as` (repo lint rule disallows type assertions). */
const parseLogType = (s: string): TraceFlagLogType => {
  if (s === 'USER_DEBUG') return 'USER_DEBUG';
  if (s === 'CLASS_TRACING') return 'CLASS_TRACING';
  return 'DEVELOPER_LOG';
};

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

    const getTraceFlagsImpl = Effect.fn('TraceFlagService.getTraceFlagsImpl')(function* () {
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
          tooling
            ? conn.tooling.query<{ Id: string; Name: string }>(soql)
            : conn.query<{ Id: string; Name: string }>(soql)
        ).pipe(Effect.map(r => r.records));
      // get the names for these IDs
      const idToName = yield* Stream.fromIterable(
        Object.entries(byPrefix).filter((entry): entry is [string, string[]] => entry[1] !== undefined)
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

    const getTraceFlagForUserImpl = Effect.fn('TraceFlagService.getTraceFlagForUserImpl')(function* (
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

    /* Adaptive TTL state: per-cache last-result + consecutive-no-change count. Service-instance scoped. */
    const allTraceFlagsAdaptive = new Map<'all', AdaptiveCacheState<TraceFlagItem[]>>();
    const traceFlagForUserAdaptive = new Map<string, AdaptiveCacheState<Option.Option<TraceFlagItem>>>();

    /** Computes next TTL via `computeAdaptiveTtl` and updates state map in place. */
    const bumpAdaptiveState = <K, T>(
      stateMap: Map<K, AdaptiveCacheState<T>>,
      key: K,
      fresh: T,
      isSame: (prior: T | undefined, fresh: T) => boolean
    ): Duration.Duration => {
      const { newCount, ttl } = computeAdaptiveTtl(stateMap.get(key), fresh, isSame);
      stateMap.set(key, { lastResult: fresh, consecutiveNoChange: newCount });
      return ttl;
    };

    /* Cached entries embed their adaptive TTL so Cache.makeWith's per-entry timeToLive(exit) can extract it. */
    type EntryAll = { readonly value: TraceFlagItem[]; readonly ttl: Duration.Duration };
    type EntryForUser = { readonly value: Option.Option<TraceFlagItem>; readonly ttl: Duration.Duration };

    const allTraceFlagsCache = yield* Cache.makeWith({
      capacity: 1,
      lookup: (_key: 'all') =>
        getTraceFlagsImpl().pipe(
          Effect.map(
            (value): EntryAll => ({
              value,
              ttl: bumpAdaptiveState(allTraceFlagsAdaptive, 'all', value, isSameTfArray)
            })
          )
        ),
      timeToLive: Exit.match({
        onSuccess: (entry: EntryAll) => entry.ttl,
        onFailure: () => Duration.zero
      })
    });

    const traceFlagForUserCache = yield* Cache.makeWith({
      capacity: 64,
      lookup: (key: string) => {
        const sepIdx = key.indexOf('::');
        const userId = key.slice(0, sepIdx);
        const logType = parseLogType(key.slice(sepIdx + 2));
        return getTraceFlagForUserImpl(userId, logType).pipe(
          Effect.map(
            (value): EntryForUser => ({
              value,
              ttl: bumpAdaptiveState(traceFlagForUserAdaptive, key, value, isSameTfOption)
            })
          )
        );
      },
      timeToLive: Exit.match({
        onSuccess: (entry: EntryForUser) => entry.ttl,
        onFailure: () => Duration.zero
      })
    });

    const getTraceFlags = Effect.fn('TraceFlagService.getTraceFlags')(function* () {
      const entry = yield* allTraceFlagsCache.get('all');
      return entry.value;
    });

    const getTraceFlagForUser = Effect.fn('TraceFlagService.getTraceFlagForUser')(function* (
      userId: string,
      logType: TraceFlagLogType = 'DEVELOPER_LOG'
    ) {
      const entry = yield* traceFlagForUserCache.get(`${userId}::${logType}`);
      return entry.value;
    });

    /**
     * Drops both caches AND resets adaptive TTL state. Called synchronously inside every
     * mutating method BEFORE PubSub.publish, so subscribers read fresh data on the next call.
     */
    const invalidateTraceFlagCaches = Effect.all([
      allTraceFlagsCache.invalidateAll,
      traceFlagForUserCache.invalidateAll,
      Effect.sync(() => {
        allTraceFlagsAdaptive.clear();
        traceFlagForUserAdaptive.clear();
      })
    ]);

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
      yield* invalidateTraceFlagCaches;
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
      yield* invalidateTraceFlagCaches;
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
      yield* invalidateTraceFlagCaches;
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
      yield* invalidateTraceFlagCaches;
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
            if (!traceFlagId) {
              return yield* new TraceFlagCreateError({ message: 'Create returned no ID' });
            }
            return { created: true, traceFlagId };
          }),
        onSome: traceFlag =>
          Effect.gen(function* () {
            if (traceFlag.expirationDate < new Date()) {
              yield* deleteTraceFlag(traceFlag.id);
              const traceFlagId = yield* createTraceFlag(userId, debugLevelId, duration, logType);
              if (!traceFlagId) {
                return yield* new TraceFlagCreateError({ message: 'Create returned no ID' });
              }
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

    const cleanupExpired = Effect.fn('TraceFlagService.cleanupExpired')(function* () {
      const userId = yield* getUserIdOrFail;
      // Cleanup must see fresh server state; bypass cache to avoid stale-read decisions.
      const existing = yield* getTraceFlagForUserImpl(userId, 'DEVELOPER_LOG');
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
      traceFlagsChanged,
      /** Drops both caches — used by the apex-log scheduler on org switch. @W-22390896 */
      invalidateCaches: invalidateTraceFlagCaches
    };
  })
}) {}
