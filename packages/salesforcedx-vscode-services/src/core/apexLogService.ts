/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as ParseResult from 'effect/ParseResult';
import * as Schema from 'effect/Schema';
import { ApexLogBodyFetchError, ApexLogQueryError } from '../errors/apexLogErrors';
import { ConnectionService } from './connectionService';
import { ApexLogListItemSchema } from './schemas/apexLogSchemas';
import { unknownToErrorCause } from './shared';

export type ApexLogListItem = Schema.Schema.Type<typeof ApexLogListItemSchema>;

const APEX_LOG_QUERY = `SELECT Id, Application, DurationMilliseconds, LogLength, LogUser.Name, Operation, StartTime, Status
  FROM ApexLog
  ORDER BY StartTime DESC`;

export class ApexLogService extends Effect.Service<ApexLogService>()('ApexLogService', {
  accessors: true,
  dependencies: [ConnectionService.Default],
  effect: Effect.gen(function* () {
    const connectionService = yield* ConnectionService;

    const listLogs = Effect.fn('ApexLogService.listLogs')(function* (limit: number = 25) {
      const conn = yield* connectionService.getConnection();
      const query = `${APEX_LOG_QUERY} LIMIT ${limit}`;
      const result = yield* Effect.tryPromise({
        try: () => conn.tooling.query(query),
        catch: error => {
          const { cause } = unknownToErrorCause(error);
          return new ApexLogQueryError({
            message: `Failed to query ApexLog: ${cause.message}`,
            cause: error
          });
        }
      });
      return yield* Effect.all(
        result.records.map(r => Schema.decodeUnknown(ApexLogListItemSchema)(r)),
        { concurrency: 'unbounded' }
      ).pipe(
        Effect.mapError((parseError: ParseResult.ParseError) => {
          const msg: string = ParseResult.TreeFormatter.formatErrorSync(parseError);
          return new ApexLogQueryError({
            message: `Failed to decode ApexLog records: ${msg}`,
            cause: parseError
          });
        })
      );
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
