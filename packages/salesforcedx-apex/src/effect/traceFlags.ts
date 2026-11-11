/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { UserId } from '../schemas/salesforceId';
import type { Connection } from '@salesforce/core';
import * as Arr from 'effect/Array';
import * as Clock from 'effect/Clock';
import * as DateTime from 'effect/DateTime';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { isNotUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { createRecord, deleteRecord, queryRecords, updateRecord } from './records';
import { DebugLevelId, TraceFlagId } from './schema/salesforceId';
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

export const getTraceFlags = Effect.fn('Apex.getTraceFlags')((connection: Connection) =>
  queryRecords({
    connection,
    operation: 'getTraceFlags',
    soql: 'SELECT Id, LogType, StartDate, ExpirationDate, DebugLevelId, DebugLevel.DeveloperName, TracedEntityId FROM TraceFlag',
    recordSchema: TraceFlagRecordSchema,
    tooling: true
  })
);

/** Finds the newest matching flag. CLI policy selects CreatedDate; other callers select ExpirationDate. */
export const getTraceFlagForUser = Effect.fn('Apex.getTraceFlagForUser')(
  (
    connection: Connection,
    userId: UserId,
    logType: TraceFlagLogType = 'DEVELOPER_LOG',
    orderBy: 'CreatedDate' | 'ExpirationDate' = 'ExpirationDate'
  ) =>
    queryRecords({
      connection,
      operation: 'getTraceFlagForUser',
      soql: `SELECT Id, StartDate, ExpirationDate, DebugLevelId, DebugLevel.DeveloperName FROM TraceFlag WHERE LogType='${quote(logType)}' AND TracedEntityId='${quote(userId)}' ORDER BY ${orderBy} DESC LIMIT 1`,
      recordSchema: TraceFlagForUserSchema,
      tooling: true
    }).pipe(Effect.map(Arr.head))
);

export const getDebugLevels = Effect.fn('Apex.getDebugLevels')((connection: Connection) =>
  queryRecords({
    connection,
    operation: 'getDebugLevels',
    soql: `SELECT ${Object.keys(DebugLevelRecordSchema.fields).join(', ')} FROM DebugLevel`,
    recordSchema: DebugLevelRecordSchema,
    tooling: true
  })
);

export const findDebugLevel = Effect.fn('Apex.findDebugLevel')((connection: Connection, developerName: string) =>
  queryRecords({
    connection,
    operation: 'findDebugLevel',
    soql: `SELECT Id FROM DebugLevel WHERE DeveloperName = '${quote(developerName)}' LIMIT 1`,
    recordSchema: Schema.Struct({ Id: DebugLevelId }),
    tooling: true
  }).pipe(Effect.map(records => Arr.head(records).pipe(Option.map(record => record.Id))))
);

export const createDebugLevel = Effect.fn('Apex.createDebugLevel')(
  (connection: Connection, payload: CreateDebugLevel) =>
    createRecord({
      connection,
      operation: 'createDebugLevel',
      type: 'DebugLevel',
      fields: payload,
      idSchema: DebugLevelId
    }).pipe(Effect.map(record => record.id))
);

export const updateDebugLevel = Effect.fn('Apex.updateDebugLevel')(
  (connection: Connection, debugLevelId: DebugLevelId, payload: UpdateDebugLevel) =>
    updateRecord({
      connection,
      operation: 'updateDebugLevel',
      type: 'DebugLevel',
      recordId: debugLevelId,
      fields: payload,
      idSchema: DebugLevelId
    })
);

export const deleteDebugLevel = Effect.fn('Apex.deleteDebugLevel')(
  (connection: Connection, debugLevelId: DebugLevelId) =>
    deleteRecord({
      connection,
      operation: 'deleteDebugLevel',
      type: 'DebugLevel',
      recordId: debugLevelId,
      idSchema: DebugLevelId
    })
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

export const createTraceFlag = Effect.fn('Apex.createTraceFlag')(function* (
  connection: Connection,
  userId: UserId,
  debugLevelId: DebugLevelId,
  duration: Duration.DurationInput = Duration.minutes(30),
  logType: TraceFlagLogType = 'DEVELOPER_LOG'
) {
  const record = yield* createRecord({
    connection,
    operation: 'createTraceFlag',
    type: 'TraceFlag',
    fields: {
      TracedEntityId: userId,
      DebugLevelId: debugLevelId,
      LogType: logType,
      StartDate: DateTime.formatIso(yield* DateTime.now),
      ExpirationDate: traceFlagExpirationDate(undefined, duration).toISOString()
    },
    idSchema: TraceFlagId
  });
  return record.id;
});

export type UpdateTraceFlagOptions = {
  readonly debugLevelId?: DebugLevelId;
  readonly expirationDate?: Date;
};

export const updateTraceFlag = Effect.fn('Apex.updateTraceFlag')(
  (connection: Connection, traceFlagId: TraceFlagId, options?: UpdateTraceFlagOptions) =>
    updateRecord({
      connection,
      operation: 'updateTraceFlag',
      type: 'TraceFlag',
      recordId: traceFlagId,
      fields: {
        StartDate: new Date().toISOString(),
        ...(isNotUndefined(options?.expirationDate) ? { ExpirationDate: options.expirationDate.toISOString() } : {}),
        ...(isNotUndefined(options?.debugLevelId) ? { DebugLevelId: options.debugLevelId } : {})
      },
      idSchema: TraceFlagId
    })
);

export const deleteTraceFlag = Effect.fn('Apex.deleteTraceFlag')((connection: Connection, traceFlagId: TraceFlagId) =>
  deleteRecord({
    connection,
    operation: 'deleteTraceFlag',
    type: 'TraceFlag',
    recordId: traceFlagId,
    idSchema: TraceFlagId
  })
);

/** Changes the relationship only, without resetting StartDate or changing category levels. */
export const changeTraceFlagDebugLevel = Effect.fn('Apex.changeTraceFlagDebugLevel')(
  (connection: Connection, traceFlagId: TraceFlagId, debugLevelId: DebugLevelId) =>
    updateRecord({
      connection,
      operation: 'changeTraceFlagDebugLevel',
      type: 'TraceFlag',
      recordId: traceFlagId,
      fields: { DebugLevelId: debugLevelId },
      idSchema: TraceFlagId
    })
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
  userId: UserId,
  debugLevelId: DebugLevelId,
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
  if (
    isNotUndefined(traceFlag.ExpirationDate) &&
    Date.parse(traceFlag.ExpirationDate) < (yield* Clock.currentTimeMillis)
  ) {
    yield* deleteTraceFlag(connection, traceFlag.Id).pipe(Effect.tap(onMutation));
    return {
      created: true,
      traceFlagId: yield* createTraceFlag(connection, userId, debugLevelId, duration, logType).pipe(
        Effect.tap(onMutation)
      )
    };
  }
  const expirationDate = traceFlagExpirationDate(traceFlag.ExpirationDate, duration);
  const expirationChanged = expirationDate.getTime() !== Date.parse(traceFlag.ExpirationDate ?? '');
  const levelChanged = traceFlag.DebugLevelId !== debugLevelId;
  if (levelChanged)
    yield* changeTraceFlagDebugLevel(connection, traceFlag.Id, debugLevelId).pipe(Effect.tap(onMutation));
  if (expirationChanged)
    yield* updateTraceFlag(connection, traceFlag.Id, { expirationDate }).pipe(Effect.tap(onMutation));
  return { created: false, traceFlagId: traceFlag.Id };
});
