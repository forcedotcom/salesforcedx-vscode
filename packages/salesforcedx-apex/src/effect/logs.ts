/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import { pipe } from 'effect/Function';
import * as Option from 'effect/Option';
import type { ParseError } from 'effect/ParseResult';
import { isNotUndefined, isString, isUndefined } from 'effect/Predicate';
import type * as Schedule from 'effect/Schedule';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { causeMessage } from './errors';
import { ApexLogBodyFetchError, ApexLogQueryError } from './schema/errors';
import {
  ListLogsOptionsSchema,
  type DecodedListLogsOptions,
  type ListLogsOptions,
  type LogStreamEvent as LogStreamEventShape
} from './schema/logs';
import { ApexLogPageSchema, type ApexLogListItem } from './schema/wire/logs';

export { ApexLogBodyFetchError, ApexLogQueryError } from './schema/errors';
export { ApexLogListItem } from './schema/wire/logs';
export { ListLogsOptionsSchema, LogStreamEventSchema } from './schema/logs';
export type { ListLogsOptions } from './schema/logs';

const buildListLogsQuery = (options?: DecodedListLogsOptions): string => {
  const userIds = options?.userIds ?? [];
  const userIdCondition =
    userIds.length > 0 ? `LogUserId IN (${userIds.map(id => `'${id.replaceAll("'", "''")}'`).join(',')})` : undefined;
  const operationCondition = options?.operationContains
    ? `Operation LIKE '%${options.operationContains.replaceAll("'", "''")}%'`
    : undefined;
  const startTimeCondition = options?.startTimeAfter ? `StartTime >= ${options.startTimeAfter}` : undefined;
  const cursorCondition = options?.cursor
    ? isUndefined(options.cursor.id)
      ? `StartTime >= ${options.cursor.startTime}`
      : `(StartTime > ${options.cursor.startTime} OR (StartTime = ${options.cursor.startTime} AND Id > '${options.cursor.id.replaceAll("'", "''")}'))`
    : undefined;
  const conditions = [userIdCondition, operationCondition, startTimeCondition, cursorCondition].filter(isNotUndefined);
  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  const orderBy = options?.orderBy ?? (options?.cursor ? 'ASC' : 'DESC');
  return `SELECT Id, Application, DurationMilliseconds, LogLength, LogUserId, LogUser.Name, Operation, StartTime, Status FROM ApexLog${where} ORDER BY StartTime ${orderBy}, Id ${orderBy}`;
};

const streamLogPagesForSoql = (connection: Connection, soql: string) => {
  const initialNextRecordsUrl: string | undefined = undefined;
  return Stream.paginateEffect<string | undefined, readonly ApexLogListItem[], ApexLogQueryError | ParseError, never>(
    initialNextRecordsUrl,
    nextRecordsUrl =>
      Effect.tryPromise({
        try: () =>
          Promise.resolve(
            isUndefined(nextRecordsUrl) ? connection.tooling.query(soql) : connection.tooling.queryMore(nextRecordsUrl)
          ),
        catch: cause => new ApexLogQueryError({ soql, message: causeMessage(cause), cause })
      }).pipe(
        Effect.flatMap(Schema.decodeUnknown(ApexLogPageSchema)),
        Effect.map(
          page =>
            [page.records, page.done ? Option.none<string>() : Option.some(page.nextRecordsUrl)] satisfies readonly [
              readonly ApexLogListItem[],
              Option.Option<string>
            ]
        )
      )
  );
};

const streamLogPages = (connection: Connection, options?: ListLogsOptions) =>
  Schema.decodeUnknown(ListLogsOptionsSchema)(options ?? {}).pipe(
    Effect.map(decodedOptions => streamLogPagesForSoql(connection, buildListLogsQuery(decodedOptions)))
  );

/** Lists logs using the caller's connection, following Tooling API query pages. */
export const listLogs = Effect.fn('Apex.listLogs')(function* (connection: Connection, options?: ListLogsOptions) {
  return yield* streamLogPages(connection, options).pipe(
    Effect.flatMap(pages => pages.pipe(Stream.flatMap(Stream.fromIterable), Stream.runCollect)),
    Effect.map(Chunk.toReadonlyArray)
  );
});

export const getLogBody = Effect.fn('Apex.getLogBody')((connection: Connection, logId: ApexLogListItem['Id']) =>
  Effect.tryPromise({
    try: () =>
      connection.request({
        method: 'GET',
        url: `/tooling/sobjects/ApexLog/${logId}/Body`
      }),
    catch: cause =>
      new ApexLogBodyFetchError({ message: `Failed to fetch ApexLog body: ${causeMessage(cause)}`, cause })
  }).pipe(Effect.map(body => (isString(body) ? body : String(body))))
);

export type LogStreamEvent = LogStreamEventShape;

export type StreamLogsOptions<R = never, ScheduleOutput = unknown> = {
  /** Receives the void poll result; the caller-defined schedule output is ignored. */
  readonly schedule: Schedule.Schedule<ScheduleOutput, void, R>;
  /** None skips this poll. The initial poll is index 0; later polls follow the schedule. */
  readonly pollOptions?: (pollIndex: number) => Effect.Effect<Option.Option<ListLogsOptions>, never, R>;
  /** Host-owned filtering/deduplication happens before requesting a body. */
  readonly filterLogs?: (logs: readonly ApexLogListItem[]) => Effect.Effect<readonly ApexLogListItem[], never, R>;
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
