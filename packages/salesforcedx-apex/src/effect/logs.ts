/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import { getErrorMessage } from '@salesforce/salesforcedx-utils';
import * as Chunk from 'effect/Chunk';
import * as DateTime from 'effect/DateTime';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';
import { isNotUndefined, isNumber, isString, isUndefined } from 'effect/Predicate';
import type * as Schedule from 'effect/Schedule';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { nls } from '../i18n';
import { MAX_NUM_LOGS } from '../logs/constants';
import { queryRecordPages } from './records';
import { ApexLogBodyFetchError, ApexLogQueryError, ApexOperationError } from './schema/errors';
import {
  EffectApexLogGetOptionsSchema,
  ListLogsOptionsSchema,
  OptionalApexLogCountSchema,
  type ApexLogResult,
  type DecodedListLogsOptions,
  type EffectApexLogGetOptions,
  type ListLogsOptions,
  type LogStreamEvent as LogStreamEventShape
} from './schema/logs';
import { ApexLogRecordSchema, type ApexLogRecord } from './schema/wire/logs';

const operationError = (operation: string, cause: unknown, message = getErrorMessage(cause)) =>
  new ApexOperationError({ operation, message, cause: getErrorMessage(cause) });

const toSoqlTimestamp = (value: string) => DateTime.unsafeMake(Date.parse(value)).pipe(DateTime.formatIso);

const buildListLogsQuery = (options?: DecodedListLogsOptions): string => {
  const userIds = options?.userIds ?? [];
  const userIdCondition =
    userIds.length > 0
      ? `LogUserId IN (${userIds.map(id => `'${id.replaceAll("'", "''")}'`).join(',')})`
      : options?.userId
        ? `LogUserId = '${options.userId.replaceAll("'", "''")}'`
        : undefined;
  const operationCondition = options?.operationContains
    ? `Operation LIKE '%${options.operationContains.replaceAll("'", "''")}%'`
    : undefined;
  const startTimeCondition = options?.startTimeAfter
    ? `StartTime >= ${toSoqlTimestamp(options.startTimeAfter)}`
    : undefined;
  const cursorCondition = options?.cursor
    ? isUndefined(options.cursor.id)
      ? `StartTime >= ${toSoqlTimestamp(options.cursor.startTime)}`
      : `(StartTime > ${toSoqlTimestamp(options.cursor.startTime)} OR (StartTime = ${toSoqlTimestamp(options.cursor.startTime)} AND Id > '${options.cursor.id.replaceAll("'", "''")}'))`
    : undefined;
  const conditions = [userIdCondition, operationCondition, startTimeCondition, cursorCondition].filter(isNotUndefined);
  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  const orderBy = options?.orderBy ?? (options?.cursor ? 'ASC' : 'DESC');
  const limit = isUndefined(options?.limit) ? '' : ` LIMIT ${options.limit}`;
  return `SELECT Id, Application, DurationMilliseconds, Location, LogLength, LogUserId, LogUser.Name, Operation, Request, StartTime, Status FROM ApexLog${where} ORDER BY StartTime ${orderBy}, Id ${orderBy}${limit}`;
};

const streamLogPagesForSoql = (connection: Connection, soql: string) =>
  queryRecordPages({
    connection,
    operation: 'listLogs',
    soql,
    recordSchema: ApexLogRecordSchema,
    tooling: true
  }).pipe(
    Stream.catchTag('ApexQueryRequestError', requestError =>
      Stream.fail(new ApexLogQueryError({ soql, message: requestError.message, cause: requestError.cause }))
    )
  );

const streamLogPages = (connection: Connection, options: ListLogsOptions | undefined) =>
  Schema.decodeUnknown(ListLogsOptionsSchema)(options ?? {}).pipe(
    Effect.map(decodedOptions => streamLogPagesForSoql(connection, buildListLogsQuery(decodedOptions)))
  );

const collectLogs = (connection: Connection, options: ListLogsOptions | undefined) =>
  streamLogPages(connection, options).pipe(
    Effect.flatMap(pages => pages.pipe(Stream.flatMap(Stream.fromIterable), Stream.runCollect)),
    Effect.map(Chunk.toReadonlyArray)
  );

/** Lists logs using the caller's connection, following Tooling API query pages. */
export const listLogs = Effect.fn('Apex.listLogs')(function* (connection: Connection, options?: ListLogsOptions) {
  return yield* collectLogs(connection, options);
});

/** Lists CLI log records, applying the CLI's positive-count validation and 25-record cap. */
export const getLogRecords = Effect.fn('Apex.getLogRecords')(function* (connection: Connection, numberOfLogs?: number) {
  const count = yield* Schema.decodeUnknown(OptionalApexLogCountSchema)(numberOfLogs).pipe(
    Effect.mapError(cause => operationError('listLogs', cause, nls.localize('numLogsError')))
  );
  const options = isUndefined(count) ? {} : { limit: Math.min(count, MAX_NUM_LOGS) };
  return yield* collectLogs(connection, options);
});

export const getLogBody = Effect.fn('Apex.getLogBody')(function* (connection: Connection, logId: ApexLogRecord['Id']) {
  return yield* Effect.tryPromise({
    try: () =>
      connection.request({
        method: 'GET',
        url: `/tooling/sobjects/ApexLog/${logId}/Body`
      }),
    catch: cause =>
      new ApexLogBodyFetchError({ message: `Failed to fetch ApexLog body: ${getErrorMessage(cause)}`, cause })
  }).pipe(Effect.map(body => (isString(body) ? body : String(body))));
});

/** Writes the body through a host-provided Effect implementation. */
export type ApexLogWriter<E = never, R = never> = (fileName: string, body: string) => Effect.Effect<string, E, R>;

/** Retrieves selected logs and optionally writes each body through the caller's writer. */
export const getLogs = Effect.fn('Apex.getLogs')(function* <E = never, R = never>(
  connection: Connection,
  options: EffectApexLogGetOptions,
  writeLog?: ApexLogWriter<E, R>
) {
  const decoded = yield* Schema.decodeUnknown(EffectApexLogGetOptionsSchema)(options).pipe(
    Effect.mapError(cause => {
      if (isUndefined(options.logId) && isUndefined(options.numberOfLogs)) {
        return operationError('getLogs', options, nls.localize('missingInfoLogError'));
      }
      return isNumber(options.numberOfLogs)
        ? operationError('getLogs', cause, nls.localize('numLogsError'))
        : operationError('getLogs', cause);
    })
  );
  const logs: ApexLogResult[] = yield* (
    isNumber(decoded.numberOfLogs)
      ? getLogRecords(connection, decoded.numberOfLogs).pipe(Effect.map(records => records.map(record => record.Id)))
      : Effect.succeed(decoded.logId ? [decoded.logId] : [])
  ).pipe(
    Effect.flatMap(logIds =>
      Effect.forEach(logIds, logId => getLogBody(connection, logId).pipe(Effect.map(log => ({ logId, log }))), {
        concurrency: 'unbounded'
      })
    )
  );
  if (isUndefined(writeLog)) return logs;
  return yield* Effect.forEach(
    logs,
    ({ logId, log }) => writeLog(`${logId}.log`, log).pipe(Effect.map(logPath => ({ logId, log, logPath }))),
    { concurrency: 'unbounded' }
  );
});

export type LogStreamEvent = LogStreamEventShape;

export type StreamLogsOptions<R = never, ScheduleOutput = unknown> = {
  /** Receives the void poll result; the caller-defined schedule output is ignored. */
  readonly schedule: Schedule.Schedule<ScheduleOutput, void, R>;
  /** None skips this poll. The initial poll is index 0; later polls follow the schedule. */
  readonly pollOptions?: (pollIndex: number) => Effect.Effect<Option.Option<ListLogsOptions>, never, R>;
  /** Host-owned filtering/deduplication happens before requesting a body. */
  readonly filterLogs?: (logs: readonly ApexLogRecord[]) => Effect.Effect<readonly ApexLogRecord[], never, R>;
};

const queryErrorEvent = (error: Extract<LogStreamEvent, { readonly _tag: 'QueryError' }>['error']): LogStreamEvent => ({
  _tag: 'QueryError',
  error
});

const pollLogs = <R, ScheduleOutput>(
  connection: Connection,
  options: StreamLogsOptions<R, ScheduleOutput>,
  filters: ListLogsOptions
): Stream.Stream<LogStreamEvent, never, R> => {
  const orderedFilters = { ...filters, orderBy: filters.orderBy ?? 'ASC' };
  return Stream.unwrap(streamLogPages(connection, orderedFilters)).pipe(
    Stream.mapEffect(logs => (isUndefined(options.filterLogs) ? Effect.succeed(logs) : options.filterLogs(logs))),
    Stream.flatMap(Stream.fromIterable),
    Stream.mapEffect(log =>
      getLogBody(connection, log.Id).pipe(
        Effect.map((body): LogStreamEvent => ({ _tag: 'Log', log, body })),
        Effect.catchTag('ApexLogBodyFetchError', error =>
          Effect.succeed<LogStreamEvent>({ _tag: 'BodyError', log, error })
        )
      )
    ),
    Stream.catchTags({
      ApexLogQueryError: error => pipe(error, queryErrorEvent, Stream.succeed),
      ParseError: error => pipe(error, queryErrorEvent, Stream.succeed)
    })
  );
};

/** Polls immediately, then on schedule. Request failures are events so later polls and bodies still run. */
export const streamLogs = <R, ScheduleOutput>(
  connection: Connection,
  options: StreamLogsOptions<R, ScheduleOutput>
): Stream.Stream<LogStreamEvent, never, R> =>
  Stream.repeatEffectWithSchedule(Effect.void, options.schedule).pipe(
    Stream.zipWithIndex,
    Stream.mapEffect(([, index]) => options.pollOptions?.(index) ?? Effect.succeed(Option.some({}))),
    Stream.filterMap(value => value),
    Stream.flatMap(filters => pollLogs(connection, options, filters))
  );
