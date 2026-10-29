/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ListLogsOptions, LogStreamEvent } from './schema/logs';
import type { Connection } from '@salesforce/core';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { isString, isUndefined } from 'effect/Predicate';
import type * as Schedule from 'effect/Schedule';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { causeMessage } from './errors';
import { ApexLogBodyFetchError, ApexLogQueryError } from './schema/errors';
import { type ApexLogListItem, LogPageSchema } from './schema/wire/logs';

const buildListLogsQuery = (limit: number, options?: ListLogsOptions): string => {
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
  const startTimeCondition = options?.startTimeAfter ? `StartTime >= ${options.startTimeAfter}` : undefined;
  const cursorCondition = options?.cursor
    ? isUndefined(options.cursor.id)
      ? `StartTime >= ${options.cursor.startTime}`
      : `(StartTime > ${options.cursor.startTime} OR (StartTime = ${options.cursor.startTime} AND Id > '${options.cursor.id.replaceAll("'", "''")}'))`
    : undefined;
  const conditions = [userIdCondition, operationCondition, startTimeCondition, cursorCondition].filter(Boolean);
  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  const orderBy = options?.orderBy ?? (options?.cursor ? 'ASC' : 'DESC');
  return `SELECT Id, Application, DurationMilliseconds, LogLength, LogUserId, LogUser.Name, Operation, StartTime, Status FROM ApexLog${where} ORDER BY StartTime ${orderBy}, Id ${orderBy} LIMIT ${limit}`;
};

/** Lists logs using the caller's connection, following Tooling API query pages. */
export const listLogs = Effect.fn('Apex.listLogs')(function* (
  connection: Connection,
  limit: number = 25,
  options?: ListLogsOptions
) {
  const soql = buildListLogsQuery(limit, options);
  return yield* Stream.paginateChunkEffect(undefined, (nextRecordsUrl: string | undefined) =>
    Effect.tryPromise({
      try: () =>
        Promise.resolve(
          isUndefined(nextRecordsUrl) ? connection.tooling.query(soql) : connection.tooling.queryMore(nextRecordsUrl)
        ),
      catch: cause => new ApexLogQueryError({ soql, message: causeMessage(cause), cause })
    }).pipe(
      Effect.flatMap(Schema.decodeUnknown(LogPageSchema)),
      Effect.map(
        page =>
          [Chunk.fromIterable(page.records), page.done ? Option.none() : Option.some(page.nextRecordsUrl)] as const
      )
    )
  ).pipe(Stream.runCollect, Effect.map(Chunk.toReadonlyArray));
});

export const getLogBody = Effect.fn('Apex.getLogBody')((connection: Connection, logId: string) =>
  Effect.tryPromise({
    try: () =>
      connection.request({
        method: 'GET',
        url: `${connection.instanceUrl}/services/data/v${connection.getApiVersion()}/tooling/sobjects/ApexLog/${logId}/Body`
      }),
    catch: cause =>
      new ApexLogBodyFetchError({ message: `Failed to fetch ApexLog body: ${causeMessage(cause)}`, cause })
  }).pipe(Effect.map(body => (isString(body) ? body : String(body))))
);

export type StreamLogsOptions<R = never> = {
  readonly schedule: Schedule.Schedule<unknown, unknown, R>;
  readonly limit?: number;
  /** None skips this poll. The initial poll is index 0; later polls follow the schedule. */
  readonly pollOptions?: (pollIndex: number) => Effect.Effect<Option.Option<ListLogsOptions>, never, R>;
  /** Host-owned filtering/deduplication happens before requesting a body. */
  readonly filterLogs?: (logs: readonly ApexLogListItem[]) => Effect.Effect<readonly ApexLogListItem[], never, R>;
};

const pollLogs = <R>(
  connection: Connection,
  limit: number | undefined,
  filterLogs: StreamLogsOptions<R>['filterLogs'],
  filters: ListLogsOptions
): Stream.Stream<LogStreamEvent, never, R> =>
  Stream.fromEffect(listLogs(connection, limit, filters)).pipe(
    Stream.mapEffect(filterLogs ?? Effect.succeed),
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
      ApexLogQueryError: error => Stream.succeed<LogStreamEvent>({ _tag: 'QueryError', error }),
      ParseError: error => Stream.succeed<LogStreamEvent>({ _tag: 'QueryError', error })
    })
  );

/** Polls immediately, then on schedule. Request failures are events so later polls and bodies still run. */
export const streamLogs = <R>(
  connection: Connection,
  options: StreamLogsOptions<R>
): Stream.Stream<LogStreamEvent, never, R> =>
  Stream.repeatEffectWithSchedule(Effect.void, options.schedule).pipe(
    Stream.zipWithIndex,
    Stream.mapEffect(([, index]) => options.pollOptions?.(index) ?? Effect.succeed(Option.some({}))),
    Stream.filterMap(value => value),
    Stream.flatMap(filters => pollLogs(connection, options.limit, options.filterLogs, filters))
  );
