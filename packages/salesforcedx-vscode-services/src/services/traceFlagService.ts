/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ConnectionService,
  QueryService,
  SalesforceId,
  TargetOrgRef,
  TraceFlagService,
  DebugLevelCreateError,
  DebugLevelDeleteError,
  TraceFlagCreateError,
  TraceFlagNotFoundError,
  TraceFlagUpdateError,
  UserIdNotFoundError,
  DebugLevelItemSchema,
  TraceFlagItemSchema,
  ToolingDebugLevelStruct,
  ToolingTraceFlagRecordSchema,
  type CreateDebugLevelPayload,
  type TraceFlagItem,
  type TraceFlagLogType
} from '@salesforce/vscode-services/v2';
import * as Arr from 'effect/Array';
import * as Cache from 'effect/Cache';
import * as Clock from 'effect/Clock';
import * as Deferred from 'effect/Deferred';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import * as Layer from 'effect/Layer';
import * as Match from 'effect/Match';
import * as Option from 'effect/Option';
import { isString } from 'effect/Predicate';
import * as PubSub from 'effect/PubSub';
import * as Result from 'effect/Result';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { unknownToErrorCause } from './errorCause.js';
import { makeScopedFibers } from './scopedFiber.js';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';

const REPLAY_DEBUGGER_LEVELS = 'ReplayDebuggerLevels';
const IdRow = Schema.Struct({ Id: SalesforceId });
const IdName = Schema.Struct({ Id: Schema.String, Name: Schema.String });
const expirationFrom = (now: number, duration: Duration.Input) => new Date(now + Duration.toMillis(duration));
const idList = (ids: readonly string[]) => ids.map(id => `'${id}'`).join(',');
const decodeOrFail =
  <A, I>(schema: Schema.Codec<A, I>, label: string) =>
  (input: unknown) =>
    Schema.decodeUnknownEffect(schema)(input).pipe(
      Effect.mapError(error => new TraceFlagNotFoundError({ message: `Failed to decode ${label}: ${error.message}` }))
    );
/** Writes cannot abort; retain admission until the SDK's public promise settles. */
const toolingWrite = <A, E>(run: () => PromiseLike<A>, failure: (cause: unknown) => E) =>
  Effect.tryPromise({ try: () => Promise.resolve(run()), catch: failure }).pipe(Effect.uninterruptible);

export const TraceFlagServiceLayer = Layer.effect(
  TraceFlagService,
  Effect.gen(function* () {
    const connections = yield* ConnectionService;
    const query = yield* QueryService;
    const orgRef = yield* TargetOrgRef;
    const operations = yield* ServiceOperations;
    const traceFlagsChanged = yield* Effect.acquireRelease(PubSub.sliding<TraceFlagItem[]>(1), PubSub.shutdown);
    const fibers = yield* makeScopedFibers;
    const names = yield* Cache.make<string, string>({
      capacity: 1000,
      timeToLive: Duration.infinity,
      lookup: (_: string) => Effect.die('idNameCache.lookup should never be called — use getOption + set')
    });
    yield* Effect.addFinalizer(() => Cache.invalidateAll(names));
    const ready = yield* Deferred.make<void>();
    yield* SubscriptionRef.changes(orgRef).pipe(
      Stream.map(info => info.orgId),
      Stream.changes,
      Stream.runForEach(() => Cache.invalidateAll(names).pipe(Effect.andThen(Deferred.succeed(ready, undefined)))),
      Effect.onExit(exit => Deferred.done(ready, Exit.isSuccess(exit) ? Exit.interrupt() : exit)),
      fibers.fork
    );
    yield* Deferred.await(ready);
    yield* Effect.addFinalizer(() => operations.close);
    const queryRows = <A, I>(soql: string, schema: Schema.Codec<A, I>, tooling = true) =>
      query
        .query(
          { soql, tooling },
          Schema.decodeUnknownEffect(
            Schema.Struct({
              totalSize: Schema.Number,
              done: Schema.optional(Schema.Boolean),
              nextRecordsUrl: Schema.optional(Schema.String),
              records: schema.pipe(Schema.Array, Schema.optional)
            })
          )
        )
        .pipe(Effect.flatMap(result => Stream.runCollect(result.records)));
    const getTraceFlags = Effect.fn('TraceFlagService.getTraceFlags')(function* () {
      const records = yield* queryRows(
        'SELECT Id, LogType, StartDate, ExpirationDate, DebugLevelId, DebugLevel.ApexCode, DebugLevel.Visualforce, DebugLevel.DeveloperName, TracedEntityId FROM TraceFlag',
        ToolingTraceFlagRecordSchema
      );
      const entities = Arr.dedupe(records.map(record => record.TracedEntityId).filter(isString));
      const misses = yield* Effect.filter(entities, id => Cache.has(names, id).pipe(Effect.map(found => !found)));
      yield* Effect.forEach(
        Object.entries(Arr.groupBy(misses, id => id.slice(0, 3))),
        ([prefix, ids]) =>
          Match.value(prefix).pipe(
            Match.when('005', () =>
              queryRows(`SELECT Id, Name FROM User WHERE Id IN (${idList(ids)})`, Schema.Unknown, false)
            ),
            Match.when('01p', () =>
              queryRows(`SELECT Id, Name FROM ApexClass WHERE Id IN (${idList(ids)})`, Schema.Unknown)
            ),
            Match.when('01q', () =>
              queryRows(`SELECT Id, Name FROM ApexTrigger WHERE Id IN (${idList(ids)})`, Schema.Unknown)
            ),
            Match.orElse(() => Effect.succeed([])),
            Effect.flatMap(rows =>
              Effect.forEach(
                rows,
                row =>
                  Schema.decodeUnknownEffect(IdName)(row).pipe(
                    Effect.tapError(error =>
                      Effect.logWarning('traceFlagService: skipping undecodable query result', error)
                    ),
                    Effect.flatMap(value => Cache.set(names, value.Id, value.Name)),
                    Effect.catchTag('SchemaError', () => Effect.void)
                  ),
                { discard: true }
              )
            )
          ),
        { discard: true }
      );
      return yield* Effect.forEach(
        records,
        record =>
          (record.TracedEntityId
            ? Cache.getOption(names, record.TracedEntityId).pipe(
                Effect.map(name => ({ ...record, TracedEntityName: Option.getOrUndefined(name) }))
              )
            : Effect.succeed(record)
          ).pipe(Effect.flatMap(decodeOrFail(TraceFlagItemSchema, 'trace flag records'))),
        { concurrency: 'unbounded' }
      );
    }, operations.run);
    // Mutation success never depended on this follow-up read. Preserve publishing [] after a typed read failure.
    const refreshFlags = () =>
      getTraceFlags().pipe(
        Effect.result,
        Effect.flatMap(result =>
          PubSub.publish(
            traceFlagsChanged,
            Result.getOrElse(result, () => [])
          )
        ),
        Effect.asVoid
      );
    const getTraceFlagForUser = Effect.fn('TraceFlagService.getTraceFlagForUser')(function* (
      userId: string,
      logType: TraceFlagLogType = 'DEVELOPER_LOG'
    ) {
      const rows = yield* queryRows(
        `SELECT Id, LogType, StartDate, ExpirationDate, DebugLevelId, DebugLevel.ApexCode, DebugLevel.Visualforce, DebugLevel.DeveloperName FROM TraceFlag WHERE LogType='${logType}' AND TracedEntityId='${userId}' ORDER BY ExpirationDate DESC LIMIT 1`,
        ToolingTraceFlagRecordSchema
      );
      return yield* Option.match(Arr.head(rows), {
        onNone: () => Effect.succeed(Option.none<TraceFlagItem>()),
        onSome: row => decodeOrFail(TraceFlagItemSchema, 'trace flag')(row).pipe(Effect.map(Option.some))
      });
    }, operations.run);
    const createDebugLevel = Effect.fn('TraceFlagService.createDebugLevel')(function* (
      payload: CreateDebugLevelPayload
    ) {
      const connection = yield* connections.getConnection();
      const result = yield* toolingWrite(
        () => connection.tooling.create('DebugLevel', payload),
        cause =>
          new DebugLevelCreateError({
            message: `Failed to create debug level: ${unknownToErrorCause(cause).cause.message}`,
            cause
          })
      );
      return result.success && result.id
        ? result.id
        : yield* new DebugLevelCreateError({ message: 'Debug level create returned no ID' });
    }, operations.run);
    const getOrCreateDebugLevel = Effect.fn('TraceFlagService.getOrCreateDebugLevel')(function* () {
      const existing = yield* queryRows(
        `SELECT Id FROM DebugLevel WHERE DeveloperName = '${REPLAY_DEBUGGER_LEVELS}' LIMIT 1`,
        IdRow
      );
      return yield* Option.match(Arr.head(existing), {
        onSome: row => Effect.succeed(row.Id),
        onNone: () =>
          createDebugLevel({
            DeveloperName: REPLAY_DEBUGGER_LEVELS,
            MasterLabel: REPLAY_DEBUGGER_LEVELS,
            ApexCode: 'FINEST',
            Visualforce: 'FINER',
            ApexProfiling: 'NONE',
            Callout: 'NONE',
            Database: 'NONE',
            Nba: 'NONE',
            System: 'NONE',
            Validation: 'NONE',
            Wave: 'NONE',
            Workflow: 'NONE'
          })
      });
    }, operations.run);
    const createTraceFlag = Effect.fn('TraceFlagService.createTraceFlag')(function* (
      userId: string,
      debugLevelId: string,
      duration: Duration.Input = Duration.minutes(30),
      logType: TraceFlagLogType = 'DEVELOPER_LOG'
    ) {
      const connection = yield* connections.getConnection();
      const now = yield* Clock.currentTimeMillis;
      const result = yield* toolingWrite(
        () =>
          connection.tooling.create('TraceFlag', {
            TracedEntityId: userId,
            LogType: logType,
            DebugLevelId: debugLevelId,
            StartDate: new Date(now).toISOString(),
            ExpirationDate: expirationFrom(now, duration).toISOString()
          }),
        cause =>
          new TraceFlagCreateError({
            message: `Failed to create trace flag: ${unknownToErrorCause(cause).cause.message}`,
            cause
          })
      );
      yield* refreshFlags();
      return result.success && result.id
        ? result.id
        : yield* new TraceFlagCreateError({ message: 'Trace flag create returned no ID' });
    }, operations.run);
    const updateTraceFlag = Effect.fn('TraceFlagService.updateTraceFlag')(function* (
      id: string,
      options?: { readonly debugLevelId?: string; readonly expirationDate?: Date }
    ) {
      const connection = yield* connections.getConnection();
      const now = yield* Clock.currentTimeMillis;
      const debugLevelId = options?.debugLevelId;
      if (debugLevelId)
        yield* toolingWrite(
          () =>
            connection.tooling.update('DebugLevel', {
              Id: debugLevelId,
              ApexCode: 'FINEST',
              Visualforce: 'FINER'
            }),
          cause =>
            new TraceFlagUpdateError({
              message: `Failed to update debug level: ${unknownToErrorCause(cause).cause.message}`,
              cause
            })
        );
      yield* toolingWrite(
        () =>
          connection.tooling.update('TraceFlag', {
            Id: id,
            StartDate: new Date(now).toISOString(),
            ...(options?.expirationDate ? { ExpirationDate: options.expirationDate.toISOString() } : {})
          }),
        cause =>
          new TraceFlagUpdateError({
            message: `Failed to update trace flag: ${unknownToErrorCause(cause).cause.message}`,
            cause
          })
      );
      yield* refreshFlags();
    }, operations.run);
    const deleteTraceFlag = Effect.fn('TraceFlagService.deleteTraceFlag')(function* (id: string) {
      const connection = yield* connections.getConnection();
      yield* toolingWrite(
        () => connection.tooling.delete('TraceFlag', id),
        cause =>
          new TraceFlagUpdateError({
            message: `Failed to delete trace flag: ${unknownToErrorCause(cause).cause.message}`,
            cause
          })
      );
      yield* refreshFlags();
    }, operations.run);
    const changeTraceFlagDebugLevel = Effect.fn('TraceFlagService.changeTraceFlagDebugLevel')(function* (
      id: string,
      debugLevelId: string
    ) {
      const connection = yield* connections.getConnection();
      yield* toolingWrite(
        () => connection.tooling.update('TraceFlag', { Id: id, DebugLevelId: debugLevelId }),
        cause =>
          new TraceFlagUpdateError({
            message: `Failed to change trace flag debug level: ${unknownToErrorCause(cause).cause.message}`,
            cause
          })
      );
      yield* refreshFlags();
    }, operations.run);
    const getUserId = Effect.fn('TraceFlagService.getUserId')(function* () {
      const { userId } = yield* SubscriptionRef.get(orgRef);
      if (!userId) return yield* new UserIdNotFoundError({ message: 'Could not determine user ID for trace flag' });
      return userId;
    }, operations.run);
    return TraceFlagService.of({
      getTraceFlags,
      getTraceFlagForUser,
      createTraceFlag,
      updateTraceFlag,
      deleteTraceFlag,
      changeTraceFlagDebugLevel,
      getOrCreateDebugLevel,
      createDebugLevel,
      getUserId,
      traceFlagsChanged,
      getDebugLevels: Effect.fn('TraceFlagService.getDebugLevels')(
        () =>
          queryRows(
            `SELECT ${Object.keys(ToolingDebugLevelStruct.fields).join(', ')} FROM DebugLevel`,
            ToolingDebugLevelStruct
          ).pipe(
            Effect.flatMap(rows =>
              Effect.forEach(rows, decodeOrFail(DebugLevelItemSchema, 'debug level records'), {
                concurrency: 'unbounded'
              })
            )
          ),
        operations.run
      ),
      deleteDebugLevel: Effect.fn('TraceFlagService.deleteDebugLevel')(function* (id: string) {
        const connection = yield* connections.getConnection();
        yield* toolingWrite(
          () => connection.tooling.delete('DebugLevel', id),
          cause =>
            new DebugLevelDeleteError({
              message: `Failed to delete debug level: ${unknownToErrorCause(cause).cause.message}`,
              cause
            })
        );
        yield* refreshFlags();
      }, operations.run),
      ensureTraceFlag: Effect.fn('TraceFlagService.ensureTraceFlag')(function* (
        userId: string,
        duration: Duration.Input = Duration.minutes(30),
        logType: TraceFlagLogType = 'DEVELOPER_LOG',
        existingDebugLevelId?: string
      ) {
        const debugLevelId = existingDebugLevelId ?? (yield* getOrCreateDebugLevel());
        const traceFlag = yield* getTraceFlagForUser(userId, logType);
        const now = yield* Clock.currentTimeMillis;
        if (Option.isNone(traceFlag))
          return { created: true, traceFlagId: yield* createTraceFlag(userId, debugLevelId, duration, logType) };
        const flag = traceFlag.value;
        if (flag.expirationDate.getTime() < now) {
          yield* deleteTraceFlag(flag.id);
          return { created: true, traceFlagId: yield* createTraceFlag(userId, debugLevelId, duration, logType) };
        }
        const expiration =
          flag.expirationDate.getTime() - now > Duration.toMillis(duration)
            ? flag.expirationDate
            : expirationFrom(now, duration);
        if (debugLevelId !== flag.debugLevelId) yield* changeTraceFlagDebugLevel(flag.id, debugLevelId);
        if (expiration.getTime() !== flag.expirationDate.getTime())
          yield* updateTraceFlag(flag.id, { expirationDate: expiration });
        return { created: false, traceFlagId: flag.id };
      }, operations.run),
      cleanupExpired: Effect.fn('TraceFlagService.cleanupExpired')(function* () {
        const flag = yield* getUserId().pipe(Effect.flatMap(userId => getTraceFlagForUser(userId)));
        const now = yield* Clock.currentTimeMillis;
        if (Option.isNone(flag) || flag.value.expirationDate.getTime() >= now) return false;
        yield* deleteTraceFlag(flag.value.id);
        return true;
      }, operations.run)
    });
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));
