/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Connection } from '@salesforce/core';
import * as Chunk from 'effect/Chunk';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { ParseError } from 'effect/ParseResult';
import { isString, isUndefined } from 'effect/Predicate';
import type * as Schedule from 'effect/Schedule';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { causeMessage } from './errors';

/** ApexLog record from Tooling API query (Id, LogLength, StartTime, Status required per API reference). */
export const ApexLogListItem = Schema.Struct({
  Id: Schema.String,
  Application: Schema.optionalWith(Schema.String, { nullable: true }),
  DurationMilliseconds: Schema.optionalWith(Schema.Number, { nullable: true }),
  LogLength: Schema.Number,
  LogUserId: Schema.optionalWith(Schema.String, { nullable: true }),
  LogUser: Schema.optionalWith(Schema.Struct({ Name: Schema.optionalWith(Schema.String, { nullable: true }) }), {
    nullable: true
  }),
  Operation: Schema.optionalWith(Schema.String, { nullable: true }),
  StartTime: Schema.String,
  Status: Schema.String
}).annotations({ identifier: 'ApexLogListItem' });
export type ApexLogListItem = typeof ApexLogListItem.Type;

export const ListLogsOptionsSchema = Schema.mutable(
  Schema.Struct({
    /** Filter to logs for this user (LogUserId). */
    userId: Schema.optional(Schema.String),
    /** Nonempty userIds takes precedence over userId. */
    userIds: Schema.optional(Schema.mutable(Schema.Array(Schema.String))),
    /** Filter to logs whose Operation contains this string (e.g. 'executeAnonymous'). */
    operationContains: Schema.optional(Schema.String),
    /** Inclusive ISO StartTime lower bound. */
    startTimeAfter: Schema.optional(Schema.String),
    /** Cursor for incremental polling; omitting id includes all records at startTime. */
    cursor: Schema.optional(Schema.Struct({ startTime: Schema.String, id: Schema.optional(Schema.String) })),
    /** Result ordering; defaults to descending, except cursor queries default to ascending. */
    orderBy: Schema.optional(Schema.Literal('ASC', 'DESC'))
  })
).annotations({ identifier: 'ListLogsOptions' });
export type ListLogsOptions = typeof ListLogsOptionsSchema.Type;

export class ApexLogQueryError extends Schema.TaggedError<ApexLogQueryError>()('ApexLogQueryError', {
  soql: Schema.String,
  message: Schema.String,
  cause: Schema.Unknown
}) {}

export class ApexLogBodyFetchError extends Schema.TaggedError<ApexLogBodyFetchError>()('ApexLogBodyFetchError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}

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

const LogPage = Schema.Struct({
  totalSize: Schema.Number,
  done: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  nextRecordsUrl: Schema.optional(Schema.String),
  records: Schema.optionalWith(Schema.Array(ApexLogListItem), { default: () => [] })
});

/** Lists logs using the caller's connection, following Tooling API query pages. */
export const listLogs = Effect.fn('Apex.listLogs')(function* (
  connection: Connection,
  limit: number = 25,
  options?: ListLogsOptions
) {
  const soql = buildListLogsQuery(limit, options);
  return yield* Stream.paginateChunkEffect(undefined as string | undefined, nextRecordsUrl =>
    Effect.tryPromise({
      try: () =>
        Promise.resolve(
          isUndefined(nextRecordsUrl) ? connection.tooling.query(soql) : connection.tooling.queryMore(nextRecordsUrl)
        ),
      catch: cause => new ApexLogQueryError({ soql, message: causeMessage(cause), cause })
    }).pipe(
      Effect.flatMap(Schema.decodeUnknown(LogPage)),
      Effect.map(
        page =>
          [
            Chunk.fromIterable(page.records),
            page.done ? Option.none() : Option.fromNullable(page.nextRecordsUrl)
          ] as const
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

export const LogStreamEventSchema = Schema.Union(
  Schema.TaggedStruct('Log', { log: ApexLogListItem, body: Schema.String }),
  Schema.TaggedStruct('QueryError', { error: Schema.Union(ApexLogQueryError, Schema.instanceOf(ParseError)) }),
  Schema.TaggedStruct('BodyError', { log: ApexLogListItem, error: ApexLogBodyFetchError })
);
export type LogStreamEvent = typeof LogStreamEventSchema.Type;

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
