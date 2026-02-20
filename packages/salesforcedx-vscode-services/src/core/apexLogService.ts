/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { ApexLogBodyFetchError, ApexLogQueryError } from '../errors/apexLogErrors';
import { ConnectionService } from './connectionService';
import { unknownToErrorCause } from './shared';

/** ApexLog record from Tooling API query (Id, LogLength, StartTime, Status required per API reference) */
export type ApexLogListItem = {
  Id: string;
  Application?: string;
  DurationMilliseconds?: number;
  LogLength: number;
  LogUserId?: string;
  LogUser?: { Name?: string };
  Operation?: string;
  StartTime: string;
  Status: string;
};

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
  const startTimeCondition = options?.startTimeAfter
    ? `StartTime >= '${options.startTimeAfter.replaceAll("'", "''")}'`
    : undefined;
  const conditions = [userIdCondition, operationCondition, startTimeCondition].filter((c): c is string => Boolean(c));
  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  return `${BASE_SELECT}${where} ORDER BY StartTime DESC LIMIT ${limit}`;
};

export class ApexLogService extends Effect.Service<ApexLogService>()('ApexLogService', {
  accessors: true,
  dependencies: [ConnectionService.Default],
  effect: Effect.gen(function* () {
    const connectionService = yield* ConnectionService;

    const listLogs = Effect.fn('ApexLogService.listLogs')(function* (limit: number = 25, options?: ListLogsOptions) {
      const conn = yield* connectionService.getConnection();
      const query = buildListLogsQuery(limit, options);
      const result = yield* Effect.tryPromise({
        try: () => conn.tooling.query<ApexLogListItem>(query),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new ApexLogQueryError({
            message: `Failed to query ApexLog: ${cause.message}`,
            cause: error
          });
        }
      });
      return result.records;
    });

    const getLogBody = Effect.fn('ApexLogService.getLogBody')(function* (logId: string) {
      const conn = yield* connectionService.getConnection();
      const apiVersion = conn.getApiVersion();
      const url = `${conn.instanceUrl}/services/data/v${apiVersion}/tooling/sobjects/ApexLog/${logId}/Body`;
      const body = yield* Effect.tryPromise({
        try: async () => {
          const res = await conn.request({ method: 'GET', url });
          return typeof res === 'string' ? res : String(res);
        },
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new ApexLogBodyFetchError({
            message: `Failed to fetch ApexLog body: ${cause.message}`,
            cause: error
          });
        }
      });
      return body;
    });

    return {
      listLogs,
      getLogBody
    };
  })
}) {}
