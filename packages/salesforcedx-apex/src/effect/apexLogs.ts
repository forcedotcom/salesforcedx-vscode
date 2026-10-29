/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Chunk from 'effect/Chunk';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { isNotUndefined, isString, isUndefined } from 'effect/Predicate';
import * as Ref from 'effect/Ref';
import * as Schedule from 'effect/Schedule';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { messages } from '../i18n/i18n';
import { MAX_NUM_LOGS } from '../logs/constants';
import { ApexOperationError, ApexResponseDecodeError, causeMessage } from './errors';
import { SalesforceId } from './salesforceId';

/** Combined CLI and services Tooling API fields; nullable optional fields normalize to undefined. */
export const ApexLogRecordSchema = Schema.Struct({
  Id: SalesforceId,
  Application: Schema.optionalWith(Schema.String, { nullable: true }),
  DurationMilliseconds: Schema.optionalWith(Schema.Number, { nullable: true }),
  Location: Schema.optionalWith(Schema.String, { nullable: true }),
  LogLength: Schema.Number,
  LogUserId: Schema.optionalWith(SalesforceId, { nullable: true }),
  LogUser: Schema.optionalWith(
    Schema.Struct({
      Name: Schema.optionalWith(Schema.String, { nullable: true }),
      attributes: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
    }),
    { nullable: true }
  ),
  Operation: Schema.optionalWith(Schema.String, { nullable: true }),
  Request: Schema.optionalWith(Schema.String, { nullable: true }),
  StartTime: Schema.String,
  Status: Schema.String
}).annotations({ identifier: 'ApexLogRecord' });
export type ApexLogRecord = typeof ApexLogRecordSchema.Type;

const Timestamp = Schema.String.pipe(
  Schema.filter(value => Number.isFinite(Date.parse(value)), { jsonSchema: { format: 'date-time' } })
);

/** Exclusive discovery position; Id breaks ties between logs with the same StartTime. */
export const ApexLogCursorSchema = Schema.Struct({ startTime: Timestamp, logId: SalesforceId }).annotations({
  identifier: 'ApexLogCursor'
});
export type ApexLogCursor = typeof ApexLogCursorSchema.Type;

export const ApexLogQueryOptionsSchema = Schema.Struct({
  userId: Schema.optional(SalesforceId),
  /** Nonempty userIds takes precedence over userId. */
  userIds: Schema.optional(Schema.Array(SalesforceId)),
  operationContains: Schema.optional(Schema.String),
  /** Inclusive lower time bound. */
  startTimeAfter: Schema.optional(Timestamp),
  cursor: Schema.optional(ApexLogCursorSchema),
  /** Omit to retrieve all matching records. */
  limit: Schema.optional(Schema.Number)
}).annotations({ identifier: 'ApexLogQueryOptions' });
export type ApexLogQueryOptions = typeof ApexLogQueryOptionsSchema.Type;

export const ApexLogGetOptionsSchema = Schema.Struct({
  logId: Schema.optional(SalesforceId),
  numberOfLogs: Schema.optional(Schema.Number)
}).annotations({ identifier: 'EffectApexLogGetOptions' });
export type ApexLogGetOptions = typeof ApexLogGetOptionsSchema.Type;

export const ApexLogResultSchema = Schema.Struct({
  logId: SalesforceId,
  log: Schema.String,
  logPath: Schema.optional(Schema.String)
}).annotations({ identifier: 'ApexLogResult' });
export type ApexLogResult = typeof ApexLogResultSchema.Type;

export const ApexLogWithBodySchema = Schema.Struct({
  record: ApexLogRecordSchema,
  log: Schema.String
}).annotations({ identifier: 'ApexLogWithBody' });
export type ApexLogWithBody = typeof ApexLogWithBodySchema.Type;

/** The host selects the directory, joins paths, and supplies an interruptible file write. */
export type ApexLogWriter<E = never, R = never> = (fileName: string, body: string) => Effect.Effect<string, E, R>;

const operationError = (operation: string, cause: unknown, message = causeMessage(cause)) =>
  new ApexOperationError({ operation, message, cause: causeMessage(cause) });

const decodeResponse = <A, I>(schema: Schema.Schema<A, I>, response: unknown) =>
  Schema.decodeUnknown(schema)(response).pipe(
    Effect.catchTag('ParseError', cause =>
      Effect.fail(
        new ApexResponseDecodeError({
          operation: 'listLogs',
          message: 'Invalid ApexLog query response',
          cause: causeMessage(cause)
        })
      )
    )
  );

const quote = (value: string) => `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
const timestamp = (value: string) => new Date(value).toISOString();

const buildQuery = (options: ApexLogQueryOptions, order: 'ASC' | 'DESC') => {
  const conditions = [
    options.userIds?.length
      ? `LogUserId IN (${options.userIds.map(quote).join(',')})`
      : options.userId
        ? `LogUserId = ${quote(options.userId)}`
        : undefined,
    options.operationContains ? `Operation LIKE ${quote(`%${options.operationContains}%`)}` : undefined,
    options.startTimeAfter ? `StartTime >= ${timestamp(options.startTimeAfter)}` : undefined,
    options.cursor
      ? `(StartTime > ${timestamp(options.cursor.startTime)} OR (StartTime = ${timestamp(options.cursor.startTime)} AND Id > ${quote(options.cursor.logId)}))`
      : undefined
  ].filter(isNotUndefined);
  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  const limit = isUndefined(options.limit) ? '' : ` LIMIT ${options.limit}`;
  return `SELECT Id, Application, DurationMilliseconds, Location, LogLength, LogUserId, LogUser.Name, Operation, Request, StartTime, Status FROM ApexLog${where} ORDER BY StartTime ${order}, Id ${order}${limit}`;
};

const QueryPage = Schema.Union(
  Schema.Struct({
    records: Schema.Array(ApexLogRecordSchema),
    done: Schema.Literal(false),
    nextRecordsUrl: Schema.NonEmptyString
  }),
  Schema.Struct({
    records: Schema.Array(ApexLogRecordSchema),
    done: Schema.optional(Schema.Literal(true))
  })
);

const queryLogs = Effect.fn('Apex.queryLogs')(function* (
  connection: Connection,
  options: typeof ApexLogQueryOptionsSchema.Encoded,
  order: 'ASC' | 'DESC'
) {
  const validated = yield* Schema.decodeUnknown(ApexLogQueryOptionsSchema)(options).pipe(
    Effect.catchTag('ParseError', cause =>
      Effect.fail(operationError('listLogs', cause, 'Invalid ApexLog query options'))
    )
  );
  const soql = buildQuery(validated, order);
  return yield* Stream.paginateChunkEffect(Option.none<string>(), next =>
    Effect.tryPromise({
      try: () =>
        Promise.resolve(
          Option.match(next, {
            onNone: () => connection.tooling.query(soql),
            onSome: url => connection.tooling.queryMore(url)
          })
        ),
      catch: cause => operationError('listLogs', cause)
    }).pipe(
      Effect.flatMap(response => decodeResponse(QueryPage, response)),
      Effect.map(
        page =>
          [
            Chunk.fromIterable(page.records),
            page.done === false ? Option.some(Option.some(page.nextRecordsUrl)) : Option.none()
          ] as const
      )
    )
  ).pipe(Stream.runCollect, Effect.map(Chunk.toReadonlyArray));
});

/** Lists newest logs first, following Tooling API query pages. */
export const listLogs = Effect.fn('Apex.listLogs')(
  (connection: Connection, options: typeof ApexLogQueryOptionsSchema.Encoded = {}) =>
    queryLogs(connection, options, 'DESC')
);

/** CLI record selection: positive counts are capped at 25; omitted counts list all records. */
export const getLogRecords = Effect.fn('Apex.getLogRecords')(function* (connection: Connection, numberOfLogs?: number) {
  if (isNotUndefined(numberOfLogs) && numberOfLogs <= 0) {
    return yield* operationError('listLogs', numberOfLogs, messages.numLogsError);
  }
  return yield* listLogs(connection, {
    limit: isUndefined(numberOfLogs) ? undefined : Math.min(numberOfLogs, MAX_NUM_LOGS)
  });
});

export const getLogBody = Effect.fn('Apex.getLogBody')((connection: Connection, logId: typeof SalesforceId.Encoded) =>
  Schema.decodeUnknown(SalesforceId)(logId).pipe(
    Effect.mapError(cause => operationError('getLogBody', cause)),
    Effect.flatMap(id =>
      Effect.tryPromise({
        try: () => connection.tooling.request<unknown>(`${connection.tooling._baseUrl()}/sobjects/ApexLog/${id}/Body`),
        catch: cause => operationError('getLogBody', cause)
      })
    ),
    Effect.map(response => (isString(response) ? response : String(response ?? '')))
  )
);

/** Writes a log through the host's filesystem implementation and waits for completion. */
export const saveLog = Effect.fn('Apex.saveLog')(function* <E, R>(
  logId: typeof SalesforceId.Encoded,
  body: string,
  writeLog: ApexLogWriter<E, R>
) {
  const id = yield* Schema.decodeUnknown(SalesforceId)(logId).pipe(
    Effect.mapError(cause => operationError('saveLog', cause))
  );
  return { logId: id, log: body, logPath: yield* writeLog(`${id}.log`, body) };
});

/** Preserves CLI selection: a numeric count takes precedence over an explicit id. */
export const getLogs = Effect.fn('Apex.getLogs')(function* <E = never, R = never>(
  connection: Connection,
  options: typeof ApexLogGetOptionsSchema.Encoded,
  writeLog?: ApexLogWriter<E, R>
) {
  if (!(isString(options.logId) || typeof options.numberOfLogs === 'number')) {
    return yield* operationError('getLogs', options, messages.missingInfoLogError);
  }
  const ids =
    typeof options.numberOfLogs === 'number'
      ? (yield* getLogRecords(connection, options.numberOfLogs)).map(record => record.Id)
      : options.logId
        ? [options.logId]
        : [];
  const logs: ApexLogResult[] = yield* Schema.decodeUnknown(Schema.Array(SalesforceId))(ids).pipe(
    Effect.mapError(cause => operationError('getLogs', cause)),
    Effect.flatMap(logIds =>
      Effect.forEach(logIds, logId => getLogBody(connection, logId).pipe(Effect.map(log => ({ logId, log }))), {
        concurrency: 'unbounded'
      })
    )
  );
  if (isUndefined(writeLog)) return logs;
  return yield* Effect.forEach(logs, ({ logId, log }) => saveLog(logId, log, writeLog));
});

/** Polls immediately, then on schedule; each subscription owns its cursor and follows every query page. */
export const streamLogs = (
  connection: Connection,
  options: Omit<typeof ApexLogQueryOptionsSchema.Encoded, 'limit'> = {},
  schedule: Schedule.Schedule<unknown, unknown> = Schedule.spaced(Duration.seconds(30))
) =>
  Ref.make(Option.fromNullable(options.cursor)).pipe(
    Effect.map(cursor =>
      Stream.repeatEffectWithSchedule(
        Ref.get(cursor).pipe(
          Effect.flatMap(position =>
            queryLogs(connection, { ...options, cursor: Option.getOrUndefined(position) }, 'ASC')
          )
        ),
        schedule
      ).pipe(
        Stream.mapConcat(records => records),
        Stream.mapEffect(record =>
          getLogBody(connection, record.Id).pipe(
            Effect.tap(() => Ref.set(cursor, Option.some({ startTime: record.StartTime, logId: record.Id }))),
            Effect.map((log): ApexLogWithBody => ({ record, log }))
          )
        )
      )
    ),
    Stream.unwrap
  );
