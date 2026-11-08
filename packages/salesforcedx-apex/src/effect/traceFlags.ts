/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Arr from 'effect/Array';
import * as Chunk from 'effect/Chunk';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { isNotUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { causeMessage } from './errors';
import { queryRecords } from './records';
import { ApexOperationError, ApexResponseDecodeError, ApexToolingMutationError } from './schema/errors';
import { QueryPageSchema } from './schema/queryPage';
import { SalesforceId } from './schema/salesforceId';
import {
  DebugLevelRecordSchema,
  TraceFlagForUserSchema,
  TraceFlagRecordSchema,
  type CreateDebugLevel,
  type TraceFlagForUser,
  type TraceFlagLogType,
  type UpdateDebugLevel
} from './schema/wire/traceFlags';

const quote = (value: string): string => value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");

const mutationResponseSchema = Schema.Struct({
  success: Schema.Boolean,
  id: Schema.optional(SalesforceId),
  errors: Schema.Unknown.pipe(Schema.Array, Schema.optional)
});

const mutate = Effect.fn('Apex.traceFlags.mutate')(function* (operation: string, request: () => PromiseLike<unknown>) {
  const result = yield* Effect.tryPromise({
    try: () => Promise.resolve(request()),
    catch: cause => new ApexOperationError({ operation, message: causeMessage(cause), cause: causeMessage(cause) })
  }).pipe(
    Effect.flatMap(Schema.decodeUnknown(mutationResponseSchema)),
    Effect.catchTag('ParseError', cause =>
      Effect.fail(
        new ApexResponseDecodeError({ operation, message: 'Invalid Tooling mutation response', cause: cause.message })
      )
    )
  );
  if (!result.success) {
    return yield* new ApexToolingMutationError({ operation, message: `Tooling ${operation} returned success=false` });
  }
  return result;
});

const createdId = (operation: string) => (result: typeof mutationResponseSchema.Type) =>
  result.id
    ? Effect.succeed(result.id)
    : Effect.fail(new ApexToolingMutationError({ operation, message: `Tooling ${operation} returned no ID` }));

const queryToolingRows = <A, I>(
  connection: Connection,
  operation: string,
  soql: string,
  record: Schema.Schema<A, I>
) => {
  const pageSchema = QueryPageSchema(record);
  const initialNextRecordsUrl: string | undefined = undefined;
  return Stream.paginateEffect<string | undefined, readonly A[], ApexOperationError | ApexResponseDecodeError, never>(
    initialNextRecordsUrl,
    nextRecordsUrl =>
      Effect.tryPromise({
        try: () =>
          Promise.resolve(
            isNotUndefined(nextRecordsUrl)
              ? connection.tooling.queryMore(nextRecordsUrl)
              : connection.tooling.query(soql)
          ),
        catch: cause => new ApexOperationError({ operation, message: causeMessage(cause), cause: causeMessage(cause) })
      }).pipe(
        Effect.flatMap(Schema.decodeUnknown(pageSchema)),
        Effect.catchTag('ParseError', cause =>
          Effect.fail(
            new ApexResponseDecodeError({ operation, message: 'Invalid Tooling query response', cause: cause.message })
          )
        ),
        Effect.map(
          page => [page.records, page.done ? Option.none<string>() : Option.fromNullable(page.nextRecordsUrl)] as const
        )
      )
  ).pipe(Stream.flatMap(Stream.fromIterable), Stream.runCollect, Effect.map(Chunk.toReadonlyArray));
};

export const getTraceFlags = Effect.fn('Apex.getTraceFlags')((connection: Connection) =>
  queryToolingRows(
    connection,
    'getTraceFlags',
    'SELECT Id, LogType, StartDate, ExpirationDate, DebugLevelId, DebugLevel.DeveloperName, TracedEntityId FROM TraceFlag',
    TraceFlagRecordSchema
  )
);

/** Finds the newest matching flag. CLI policy selects CreatedDate; other callers select ExpirationDate. */
export const getTraceFlagForUser = Effect.fn('Apex.getTraceFlagForUser')(
  (
    connection: Connection,
    userId: SalesforceId,
    logType: TraceFlagLogType = 'DEVELOPER_LOG',
    orderBy: 'CreatedDate' | 'ExpirationDate' = 'ExpirationDate'
  ) =>
    queryRecords({
      connection,
      operation: 'getTraceFlagForUser',
      soql: `SELECT Id, StartDate, ExpirationDate, DebugLevelId, DebugLevel.DeveloperName FROM TraceFlag WHERE LogType='${quote(logType)}' AND TracedEntityId='${quote(userId)}' ORDER BY ${orderBy} DESC LIMIT 1`,
      record: TraceFlagForUserSchema,
      tooling: true
    }).pipe(Effect.map(Arr.head))
);

export const getDebugLevels = Effect.fn('Apex.getDebugLevels')((connection: Connection) =>
  queryToolingRows(
    connection,
    'getDebugLevels',
    `SELECT ${Object.keys(DebugLevelRecordSchema.fields).join(', ')} FROM DebugLevel`,
    DebugLevelRecordSchema
  )
);

export const findDebugLevel = Effect.fn('Apex.findDebugLevel')((connection: Connection, developerName: string) =>
  queryRecords({
    connection,
    operation: 'findDebugLevel',
    soql: `SELECT Id FROM DebugLevel WHERE DeveloperName = '${quote(developerName)}' LIMIT 1`,
    record: Schema.Struct({ Id: SalesforceId }),
    tooling: true
  }).pipe(Effect.map(records => Arr.head(records).pipe(Option.map(record => record.Id))))
);

export const createDebugLevel = Effect.fn('Apex.createDebugLevel')(
  (connection: Connection, payload: CreateDebugLevel) =>
    mutate('createDebugLevel', () => connection.tooling.create('DebugLevel', payload)).pipe(
      Effect.flatMap(createdId('createDebugLevel'))
    )
);

export const updateDebugLevel = Effect.fn('Apex.updateDebugLevel')(
  (connection: Connection, debugLevelId: SalesforceId, payload: UpdateDebugLevel) =>
    mutate('updateDebugLevel', () => connection.tooling.update('DebugLevel', { ...payload, Id: debugLevelId })).pipe(
      Effect.asVoid
    )
);

export const deleteDebugLevel = Effect.fn('Apex.deleteDebugLevel')(
  (connection: Connection, debugLevelId: SalesforceId) =>
    mutate('deleteDebugLevel', () => connection.tooling.delete('DebugLevel', debugLevelId)).pipe(Effect.asVoid)
);

/** Reuses a named level without modifying it; the caller supplies its creation policy. */
export const getOrCreateDebugLevel = Effect.fn('Apex.getOrCreateDebugLevel')(
  (connection: Connection, payload: CreateDebugLevel) =>
    findDebugLevel(connection, payload.DeveloperName).pipe(
      Effect.flatMap(Option.match({ onNone: () => createDebugLevel(connection, payload), onSome: Effect.succeed }))
    )
);

/** Keeps a later expiration, otherwise extends to at least the requested duration from now. */
export const traceFlagExpirationDate = (
  expirationDate?: string,
  duration: Duration.DurationInput = Duration.minutes(30)
): Date => {
  const minimum = Date.now() + Duration.toMillis(duration);
  const existing = isNotUndefined(expirationDate) ? new Date(expirationDate).getTime() : 0;
  return new Date(existing > minimum ? existing : minimum);
};

export const createTraceFlag = Effect.fn('Apex.createTraceFlag')(
  (
    connection: Connection,
    userId: SalesforceId,
    debugLevelId: SalesforceId,
    duration: Duration.DurationInput = Duration.minutes(30),
    logType: TraceFlagLogType = 'DEVELOPER_LOG'
  ) =>
    mutate('createTraceFlag', () =>
      connection.tooling.create('TraceFlag', {
        TracedEntityId: userId,
        DebugLevelId: debugLevelId,
        LogType: logType,
        StartDate: new Date().toISOString(),
        ExpirationDate: traceFlagExpirationDate(undefined, duration).toISOString()
      })
    ).pipe(Effect.flatMap(createdId('createTraceFlag')))
);

export type UpdateTraceFlagOptions = {
  readonly debugLevelId?: SalesforceId;
  readonly expirationDate?: Date;
};

export const updateTraceFlag = Effect.fn('Apex.updateTraceFlag')(
  (connection: Connection, traceFlagId: SalesforceId, options?: UpdateTraceFlagOptions) =>
    mutate('updateTraceFlag', () =>
      connection.tooling.update('TraceFlag', {
        Id: traceFlagId,
        StartDate: new Date().toISOString(),
        ...(isNotUndefined(options?.expirationDate) ? { ExpirationDate: options.expirationDate.toISOString() } : {}),
        ...(isNotUndefined(options?.debugLevelId) ? { DebugLevelId: options.debugLevelId } : {})
      })
    ).pipe(Effect.asVoid)
);

export const deleteTraceFlag = Effect.fn('Apex.deleteTraceFlag')((connection: Connection, traceFlagId: SalesforceId) =>
  mutate('deleteTraceFlag', () => connection.tooling.delete('TraceFlag', traceFlagId)).pipe(Effect.asVoid)
);

/** Changes the relationship only, without resetting StartDate or changing category levels. */
export const changeTraceFlagDebugLevel = Effect.fn('Apex.changeTraceFlagDebugLevel')(
  (connection: Connection, traceFlagId: SalesforceId, debugLevelId: SalesforceId) =>
    mutate('changeTraceFlagDebugLevel', () =>
      connection.tooling.update('TraceFlag', { Id: traceFlagId, DebugLevelId: debugLevelId })
    ).pipe(Effect.asVoid)
);

/** Renews an existing flag in place; CLI keeps this policy even for expired flags. */
export const extendTraceFlag = Effect.fn('Apex.extendTraceFlag')(
  (connection: Connection, traceFlag: TraceFlagForUser, duration: Duration.DurationInput = Duration.minutes(30)) =>
    updateTraceFlag(connection, traceFlag.Id, {
      expirationDate: traceFlagExpirationDate(traceFlag.ExpirationDate, duration)
    })
);

/** Caller-owned notification runs after each successful write. */
export type EnsureTraceFlagOptions<E = never, R = never> = {
  readonly duration?: Duration.DurationInput;
  readonly logType?: TraceFlagLogType;
  /** Hosts can refresh after each successful write, including writes preceding a later failure. */
  readonly onMutation?: () => Effect.Effect<void, E, R>;
};

/** Ensures a flag using the caller-selected level; expired flags are replaced, not renewed. */
export const ensureTraceFlag = Effect.fn('Apex.ensureTraceFlag')(function* <E = never, R = never>(
  connection: Connection,
  userId: SalesforceId,
  debugLevelId: SalesforceId,
  options: EnsureTraceFlagOptions<E, R> = {}
) {
  const { duration = Duration.minutes(30), logType = 'DEVELOPER_LOG', onMutation = () => Effect.void } = options;
  const existing = yield* getTraceFlagForUser(connection, userId, logType);
  if (Option.isNone(existing)) {
    return {
      created: true,
      traceFlagId: yield* createTraceFlag(connection, userId, debugLevelId, duration, logType).pipe(
        Effect.tap(onMutation)
      )
    };
  }
  const traceFlag = existing.value;
  if (isNotUndefined(traceFlag.ExpirationDate) && new Date(traceFlag.ExpirationDate).getTime() < Date.now()) {
    yield* deleteTraceFlag(connection, traceFlag.Id).pipe(Effect.tap(onMutation));
    return {
      created: true,
      traceFlagId: yield* createTraceFlag(connection, userId, debugLevelId, duration, logType).pipe(
        Effect.tap(onMutation)
      )
    };
  }
  const expirationDate = traceFlagExpirationDate(traceFlag.ExpirationDate, duration);
  const expirationChanged = expirationDate.getTime() !== new Date(traceFlag.ExpirationDate ?? '').getTime();
  const levelChanged = traceFlag.DebugLevelId !== debugLevelId;
  if (levelChanged)
    yield* changeTraceFlagDebugLevel(connection, traceFlag.Id, debugLevelId).pipe(Effect.tap(onMutation));
  if (expirationChanged)
    yield* updateTraceFlag(connection, traceFlag.Id, { expirationDate }).pipe(Effect.tap(onMutation));
  return { created: false, traceFlagId: traceFlag.Id };
});
