/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as apex from '@salesforce/apex-node/effect';
import * as Arr from 'effect/Array';
import * as Cache from 'effect/Cache';
import * as Chunk from 'effect/Chunk';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as Option from 'effect/Option';
import * as ParseResult from 'effect/ParseResult';
import { isNotUndefined } from 'effect/Predicate';
import * as PubSub from 'effect/PubSub';
import { toEntries } from 'effect/Record';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import {
  DebugLevelCreateError,
  DebugLevelDeleteError,
  TraceFlagCreateError,
  TraceFlagNotFoundError,
  TraceFlagUpdateError,
  UserIdNotFoundError
} from '../errors/traceFlagErrors';
import { getExtensionScope } from '../vscode/extensionScope';
import { ConnectionService } from './connectionService';
import { getDefaultOrgRef } from './defaultOrgRef';
import { QueryService } from './queryService';
import {
  DebugLevelItemSchema,
  TraceFlagItemSchema,
  type CreateDebugLevelPayload,
  type TraceFlagItem,
  type TraceFlagLogType
} from './schemas/traceFlagSchemas';

const APEX_CODE_DEBUG_LEVEL = 'FINEST';
const VISUALFORCE_DEBUG_LEVEL = 'FINER';

/** DebugLevel.DeveloperName used for replay-debugger trace flags. Created on demand via getOrCreateDebugLevel. */
const REPLAY_DEBUGGER_LEVELS = 'ReplayDebuggerLevels';

const idListToInClause = (ids: string[]) => ids.map(id => `'${id}'`).join(',');

const decodeSalesforceId = Schema.decodeUnknown(apex.TraceFlagRecordSchema.fields.Id);

/** Decode `input` against `schema`, remapping any ParseError to a labeled TraceFlagNotFoundError. */
const decodeOrFail =
  <A, I>(schema: Schema.Schema<A, I>, label: string) =>
  (input: unknown) =>
    Schema.decodeUnknown(schema)(input).pipe(
      Effect.mapError(
        (parseError: ParseResult.ParseError) =>
          new TraceFlagNotFoundError({
            message: `Failed to decode ${label}: ${ParseResult.TreeFormatter.formatErrorSync(parseError)}`
          })
      )
    );

const getUserIdOrFail = Effect.gen(function* () {
  const ref = yield* getDefaultOrgRef();
  const { userId } = yield* SubscriptionRef.get(ref);
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- yield* must be in statement position
  return userId ? userId : yield* new UserIdNotFoundError({ message: 'Could not determine user ID for trace flag' });
});

const queryRows = <A, I>(soql: string, schema: Schema.Schema<A, I, never>, tooling = true) =>
  Effect.flatMap(QueryService, queryService =>
    queryService.query({ soql, tooling }, schema).pipe(
      Effect.flatMap(({ records }) => Stream.runCollect(records)),
      Effect.map(Chunk.toReadonlyArray)
    )
  );

const queryIdName = (soql: string, tooling: boolean) => queryRows(soql, Schema.Unknown, tooling);

export class TraceFlagService extends Effect.Service<TraceFlagService>()('TraceFlagService', {
  accessors: true,
  dependencies: [ConnectionService.Default, QueryService.Default],
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

    // Invalidate cache when default org identity (orgId) changes. Fiber tied to the extension scope.
    yield* getDefaultOrgRef().pipe(
      Effect.flatMap(ref =>
        ref.changes.pipe(
          Stream.map(info => info.orgId),
          Stream.changes,
          Stream.drop(1),
          Stream.runForEach(() => idNameCache.invalidateAll)
        )
      ),
      Effect.forkIn(yield* getExtensionScope())
    );

    const getTraceFlags = Effect.fn('TraceFlagService.getTraceFlags')(function* () {
      const traceFlagRecords = yield* connectionService.getConnection().pipe(
        Effect.flatMap(apex.getTraceFlags),
        Effect.mapError(error => new TraceFlagNotFoundError({ message: error.message }))
      );
      const entitiesToResolve = Arr.dedupe(traceFlagRecords.map(r => r.TracedEntityId).filter(isNotUndefined));

      if (entitiesToResolve.length === 0) {
        return yield* Effect.all(traceFlagRecords.map(decodeOrFail(TraceFlagItemSchema, 'trace flag records')), {
          concurrency: 'unbounded'
        });
      }

      // Misses only, grouped by id prefix, then one SOQL batch per prefix. Rows fill the cache as they arrive.
      yield* Effect.filter(entitiesToResolve, id => idNameCache.contains(id), {
        concurrency: 'unbounded',
        negate: true
      }).pipe(
        Effect.map(misses => toEntries(Arr.groupBy(misses, id => id.slice(0, 3)))),
        Effect.flatMap(groups =>
          Stream.fromIterable(groups).pipe(
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
            Stream.mapConcatEffect(result =>
              Schema.decodeUnknown(Schema.Struct({ Id: Schema.String, Name: Schema.String }))(result).pipe(
                Effect.tapError(e => Effect.logWarning('traceFlagService: skipping undecodable query result', e)),
                Effect.map(row => [row]),
                Effect.orElseSucceed(() => [])
              )
            ),
            Stream.runForEach(row => idNameCache.set(row.Id, row.Name))
          )
        )
      );

      // Cache is the single source of truth — read each record's name directly. Misses stay undefined.
      return yield* Effect.all(
        traceFlagRecords.map(rec =>
          (rec.TracedEntityId
            ? idNameCache
                .getOption(rec.TracedEntityId)
                .pipe(Effect.map(opt => ({ ...rec, TracedEntityName: Option.getOrUndefined(opt) })))
            : Effect.succeed(rec)
          ).pipe(Effect.flatMap(decodeOrFail(TraceFlagItemSchema, 'trace flag records')))
        ),
        { concurrency: 'unbounded' }
      );
    });

    const getDebugLevels = Effect.fn('TraceFlagService.getDebugLevels')(function* () {
      return yield* connectionService.getConnection().pipe(
        Effect.flatMap(apex.getDebugLevels),
        Effect.mapError(error => new TraceFlagNotFoundError({ message: error.message })),
        Effect.flatMap(debugLevelRecords =>
          Effect.all(debugLevelRecords.map(decodeOrFail(DebugLevelItemSchema, 'debug level records')), {
            concurrency: 'unbounded'
          })
        )
      );
    });

    const publishTraceFlags = Effect.fn('TraceFlagService.publishTraceFlags')(function* () {
      // A failed refresh must not turn a successful Tooling write into a reported write failure.
      const flags = yield* getTraceFlags().pipe(Effect.catchAll(() => Effect.succeed([])));
      yield* PubSub.publish(traceFlagsChanged, flags);
    });

    const getTraceFlagForUser = Effect.fn('TraceFlagService.getTraceFlagForUser')(function* (
      userId: string,
      logType: TraceFlagLogType = 'DEVELOPER_LOG'
    ) {
      return yield* connectionService.getConnection().pipe(
        Effect.flatMap(connection =>
          decodeSalesforceId(userId).pipe(Effect.flatMap(id => apex.getTraceFlagForUser(connection, id, logType)))
        ),
        Effect.mapError(error => new TraceFlagNotFoundError({ message: error.message })),
        Effect.flatMap(
          Effect.transposeMapOption(record =>
            decodeOrFail(TraceFlagItemSchema, 'trace flag')({ ...record, LogType: logType })
          )
        )
      );
    });

    const createDebugLevel = Effect.fn('TraceFlagService.createDebugLevel')(function* (
      payload: CreateDebugLevelPayload
    ) {
      const conn = yield* connectionService.getConnection();
      return yield* apex
        .createDebugLevel(conn, payload)
        .pipe(
          Effect.mapError(
            error =>
              new DebugLevelCreateError({ message: `Failed to create debug level: ${error.message}`, cause: error })
          )
        );
    });

    const getOrCreateDebugLevel = Effect.fn('TraceFlagService.getOrCreateDebugLevel')(function* () {
      return yield* connectionService.getConnection().pipe(
        Effect.flatMap(connection =>
          apex.getOrCreateDebugLevel(connection, {
            DeveloperName: REPLAY_DEBUGGER_LEVELS,
            MasterLabel: REPLAY_DEBUGGER_LEVELS,
            ApexCode: APEX_CODE_DEBUG_LEVEL,
            ApexProfiling: 'NONE',
            Callout: 'NONE',
            Database: 'NONE',
            Nba: 'NONE',
            System: 'NONE',
            Validation: 'NONE',
            Visualforce: VISUALFORCE_DEBUG_LEVEL,
            Wave: 'NONE',
            Workflow: 'NONE'
          })
        ),
        Effect.mapError(
          error =>
            new DebugLevelCreateError({
              message: `Failed to get or create debug level: ${error.message}`,
              cause: error
            })
        )
      );
    });

    const deleteDebugLevel = Effect.fn('TraceFlagService.deleteDebugLevel')(function* (debugLevelId: string) {
      const conn = yield* connectionService.getConnection();
      yield* decodeSalesforceId(debugLevelId).pipe(
        Effect.flatMap(id => apex.deleteDebugLevel(conn, id)),
        Effect.mapError(
          error =>
            new DebugLevelDeleteError({ message: `Failed to delete debug level: ${error.message}`, cause: error })
        )
      );
      yield* publishTraceFlags();
    });

    const createTraceFlag = Effect.fn('TraceFlagService.createTraceFlag')(function* (
      userId: string,
      debugLevelId: string,
      duration = Duration.minutes(30),
      logType: TraceFlagLogType = 'DEVELOPER_LOG'
    ) {
      const conn = yield* connectionService.getConnection();
      const traceFlagId = yield* Effect.all({
        userId: decodeSalesforceId(userId),
        debugLevelId: decodeSalesforceId(debugLevelId)
      }).pipe(
        Effect.flatMap(ids => apex.createTraceFlag(conn, ids.userId, ids.debugLevelId, duration, logType)),
        Effect.mapError(
          error => new TraceFlagCreateError({ message: `Failed to create trace flag: ${error.message}`, cause: error })
        )
      );
      yield* publishTraceFlags();
      return traceFlagId;
    });

    const updateTraceFlag = Effect.fn('TraceFlagService.updateTraceFlag')(function* (
      traceFlagId: string,
      options?: { debugLevelId?: string; expirationDate?: Date }
    ) {
      const conn = yield* connectionService.getConnection();
      if (options?.debugLevelId) {
        yield* decodeSalesforceId(options.debugLevelId).pipe(
          Effect.flatMap(id =>
            apex.updateDebugLevel(conn, id, {
              ApexCode: APEX_CODE_DEBUG_LEVEL,
              Visualforce: VISUALFORCE_DEBUG_LEVEL
            })
          ),
          Effect.mapError(
            error =>
              new TraceFlagUpdateError({ message: `Failed to update debug level: ${error.message}`, cause: error })
          )
        );
      }
      yield* decodeSalesforceId(traceFlagId).pipe(
        Effect.flatMap(id => apex.updateTraceFlag(conn, id, { expirationDate: options?.expirationDate })),
        Effect.mapError(
          error => new TraceFlagUpdateError({ message: `Failed to update trace flag: ${error.message}`, cause: error })
        )
      );
      yield* publishTraceFlags();
    });

    const deleteTraceFlag = Effect.fn('TraceFlagService.deleteTraceFlag')(function* (traceFlagId: string) {
      const conn = yield* connectionService.getConnection();
      yield* decodeSalesforceId(traceFlagId).pipe(
        Effect.flatMap(id => apex.deleteTraceFlag(conn, id)),
        Effect.mapError(
          error => new TraceFlagUpdateError({ message: `Failed to delete trace flag: ${error.message}`, cause: error })
        )
      );
      yield* publishTraceFlags();
    });

    const changeTraceFlagDebugLevel = Effect.fn('TraceFlagService.changeTraceFlagDebugLevel')(function* (
      traceFlagId: string,
      newDebugLevelId: string
    ) {
      const conn = yield* connectionService.getConnection();
      yield* Effect.all({
        traceFlagId: decodeSalesforceId(traceFlagId),
        debugLevelId: decodeSalesforceId(newDebugLevelId)
      }).pipe(
        Effect.flatMap(ids => apex.changeTraceFlagDebugLevel(conn, ids.traceFlagId, ids.debugLevelId)),
        Effect.mapError(
          error =>
            new TraceFlagUpdateError({
              message: `Failed to change trace flag debug level: ${error.message}`,
              cause: error
            })
        )
      );
      yield* publishTraceFlags();
    });

    const ensureTraceFlag = Effect.fn('TraceFlagService.ensureTraceFlag')(function* (
      userId: string,
      duration = Duration.minutes(30),
      logType: TraceFlagLogType = 'DEVELOPER_LOG',
      existingDebugLevelId?: string
    ) {
      const debugLevelId = existingDebugLevelId ?? (yield* getOrCreateDebugLevel());
      const ids = yield* Effect.all({
        userId: decodeOrFail(apex.TraceFlagRecordSchema.fields.Id, 'user ID')(userId),
        debugLevelId: decodeOrFail(apex.TraceFlagRecordSchema.fields.Id, 'debug level ID')(debugLevelId)
      });
      return yield* connectionService.getConnection().pipe(
        Effect.flatMap(connection =>
          apex
            .ensureTraceFlag(connection, ids.userId, ids.debugLevelId, {
              duration,
              logType,
              onMutation: publishTraceFlags
            })
            .pipe(
              Effect.mapError(error =>
                Match.value(error.operation).pipe(
                  Match.when(
                    'createTraceFlag',
                    () =>
                      new TraceFlagCreateError({
                        message: `Failed to create trace flag: ${error.message}`,
                        cause: error
                      })
                  ),
                  Match.when('getTraceFlagForUser', () => new TraceFlagNotFoundError({ message: error.message })),
                  Match.orElse(
                    () =>
                      new TraceFlagUpdateError({
                        message: `Failed to ensure trace flag: ${error.message}`,
                        cause: error
                      })
                  )
                )
              )
            )
        )
      );
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
      createDebugLevel,
      deleteDebugLevel,
      getUserId,
      traceFlagsChanged
    };
  })
}) {}
