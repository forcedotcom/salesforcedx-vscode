/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { isString } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { ApexLogBodyFetchError } from '../errors/apexLogErrors';
import { ConnectionService } from './connectionService';
import { QueryService } from './queryService';
import { unknownToErrorCause } from './shared';

const LogUser = Schema.Struct({
  Name: Schema.optionalWith(Schema.String, { nullable: true })
});

/** ApexLog record from Tooling API query (Id, LogLength, StartTime, Status required per API reference) */
export const ApexLogListItem = Schema.Struct({
  Id: Schema.String,
  Application: Schema.optionalWith(Schema.String, { nullable: true }),
  DurationMilliseconds: Schema.optionalWith(Schema.Number, { nullable: true }),
  LogLength: Schema.Number,
  LogUserId: Schema.optionalWith(Schema.String, { nullable: true }),
  LogUser: Schema.optionalWith(LogUser, { nullable: true }),
  Operation: Schema.optionalWith(Schema.String, { nullable: true }),
  StartTime: Schema.String,
  Status: Schema.String
});
export type ApexLogListItem = Schema.Schema.Type<typeof ApexLogListItem>;

export type ListLogsOptions = {
  /** Filter to logs for this user (LogUserId) */
  userId?: string;
  /** Filter to logs for these users (LogUserId IN). When set, userId is ignored. */
  userIds?: string[];
  /** Filter to logs whose Operation contains this string (e.g. 'executeAnonymous') */
  operationContains?: string;
  /** Filter to logs with StartTime >= this ISO string (trace-flag-aware polling) */
  startTimeAfter?: string;
};

const BASE_SELECT =
  'SELECT Id, Application, DurationMilliseconds, LogLength, LogUserId, LogUser.Name, Operation, StartTime, Status FROM ApexLog';

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
  const conditions = [userIdCondition, operationCondition, startTimeCondition].filter(Boolean);
  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  return `${BASE_SELECT}${where} ORDER BY StartTime DESC LIMIT ${limit}`;
};

export class ApexLogService extends Effect.Service<ApexLogService>()('ApexLogService', {
  accessors: true,
  dependencies: [ConnectionService.Default, QueryService.Default],
  effect: Effect.gen(function* () {
    const connectionService = yield* ConnectionService;

    const listLogs = Effect.fn('ApexLogService.listLogs')(function* (limit: number = 25, options?: ListLogsOptions) {
      return yield* QueryService.pipe(
        Effect.flatMap(queryService =>
          queryService.query({ soql: buildListLogsQuery(limit, options), tooling: true }, ApexLogListItem)
        ),
        Effect.map(result => result.records)
      );
    });

    const getLogBody = Effect.fn('ApexLogService.getLogBody')(function* (logId: string) {
      return yield* connectionService.getConnection().pipe(
        Effect.flatMap(conn =>
          Effect.tryPromise({
            try: async () => {
              const res = await conn.request({
                method: 'GET',
                url: `${conn.instanceUrl}/services/data/v${conn.getApiVersion()}/tooling/sobjects/ApexLog/${logId}/Body`
              });
              return isString(res) ? res : String(res);
            },
            catch: error => {
              const { cause } = unknownToErrorCause(error);
              return new ApexLogBodyFetchError({
                message: `Failed to fetch ApexLog body: ${cause.message}`,
                cause: error
              });
            }
          })
        )
      );
    });

    return {
      listLogs,
      getLogBody
    };
  })
}) {}
