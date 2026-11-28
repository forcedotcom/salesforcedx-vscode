/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ApexLogBodyFetchError,
  ApexLogListItem,
  ApexLogService,
  ConnectionService,
  QueryService,
  type ListLogsOptions
} from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { isString } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { unknownToErrorCause } from './errorCause.js';
import { ServiceOperations, ServiceOperationsLayer } from './serviceOperations.js';

const BASE_SELECT =
  'SELECT Id, Application, DurationMilliseconds, LogLength, LogUserId, LogUser.Name, Operation, StartTime, Status FROM ApexLog';
const buildListLogsQuery = (limit: number, options?: ListLogsOptions): string => {
  const userIds = options?.userIds ?? [];
  const user =
    userIds.length > 0
      ? `LogUserId IN (${userIds.map(id => `'${id.replaceAll("'", "''")}'`).join(',')})`
      : options?.userId
        ? `LogUserId = '${options.userId.replaceAll("'", "''")}'`
        : undefined;
  const operation = options?.operationContains
    ? `Operation LIKE '%${options.operationContains.replaceAll("'", "''")}%'`
    : undefined;
  const since = options?.startTimeAfter ? `StartTime >= ${options.startTimeAfter}` : undefined;
  const conditions = [user, operation, since].filter(Boolean);
  const rowLimit = options?.noLimit ? '' : ` LIMIT ${limit}`;
  return `${BASE_SELECT}${conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : ''} ORDER BY StartTime DESC${rowLimit}`;
};
const decodePage = Schema.decodeUnknownEffect(
  Schema.Struct({
    totalSize: Schema.Number,
    done: Schema.optional(Schema.Boolean),
    nextRecordsUrl: Schema.optional(Schema.String),
    records: ApexLogListItem.pipe(Schema.Array, Schema.optional)
  })
);
export const ApexLogServiceLayer = Layer.effect(
  ApexLogService,
  Effect.gen(function* () {
    const connections = yield* ConnectionService;
    const query = yield* QueryService;
    const operations = yield* ServiceOperations;
    return ApexLogService.of({
      listLogs: Effect.fn('ApexLogService.listLogs')(
        (limit = 25, options?: ListLogsOptions) =>
          query
            .query({ soql: buildListLogsQuery(limit, options), tooling: true }, decodePage)
            .pipe(Effect.flatMap(result => Stream.runCollect(result.records))),
        operations.run
      ),
      getLogBody: Effect.fn('ApexLogService.getLogBody')(
        (logId: string) =>
          connections.getConnection().pipe(
            Effect.flatMap(connection =>
              Effect.tryPromise({
                try: async () => {
                  const response = await connection.request({
                    method: 'GET',
                    url: `${connection.instanceUrl}/services/data/v${connection.getApiVersion()}/tooling/sobjects/ApexLog/${logId}/Body`
                  });
                  return isString(response) ? response : String(response);
                },
                catch: error =>
                  new ApexLogBodyFetchError({
                    message: `Failed to fetch ApexLog body: ${unknownToErrorCause(error).cause.message}`,
                    cause: error
                  })
              })
            )
          ),
        operations.run
      )
    });
  })
).pipe(Layer.provideMerge(ServiceOperationsLayer));
