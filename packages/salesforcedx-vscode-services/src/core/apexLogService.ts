/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  ApexLogRecordSchema,
  getLogBody as fetchLogBody,
  listLogs as queryLogs,
  type ApexLogQueryOptionsSchema
} from '@salesforce/apex-node/effect';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { ApexLogBodyFetchError } from '../errors/apexLogErrors';
import { ConnectionService } from './connectionService';

const LogUser = Schema.Struct({
  Name: Schema.optionalWith(Schema.String, { nullable: true })
});

/** ApexLog record from Tooling API query (Id, LogLength, StartTime, Status required per API reference) */
export const ApexLogListItem = Schema.Struct({
  ...ApexLogRecordSchema.omit('Location', 'Request', 'LogUser').fields,
  Id: Schema.String,
  LogUserId: Schema.optionalWith(Schema.String, { nullable: true }),
  LogUser: Schema.optionalWith(LogUser, { nullable: true })
});
export type ApexLogListItem = Schema.Schema.Type<typeof ApexLogListItem>;

/** Preserve the services API's mutable options and userIds array. */
export type ListLogsOptions = {
  -readonly [Field in keyof Pick<
    typeof ApexLogQueryOptionsSchema.Encoded,
    'userId' | 'userIds' | 'operationContains' | 'startTimeAfter'
  >]: Field extends 'userIds' ? string[] | undefined : (typeof ApexLogQueryOptionsSchema.Encoded)[Field];
};

export class ApexLogService extends Effect.Service<ApexLogService>()('ApexLogService', {
  accessors: true,
  dependencies: [ConnectionService.Default],
  effect: Effect.gen(function* () {
    const connectionService = yield* ConnectionService;

    const listLogs = Effect.fn('ApexLogService.listLogs')(function* (limit: number = 25, options?: ListLogsOptions) {
      return yield* connectionService.getConnection().pipe(
        Effect.flatMap(connection => queryLogs(connection, { ...options, limit })),
        Effect.flatMap(Schema.decodeUnknown(Schema.Array(ApexLogListItem)))
      );
    });

    const getLogBody = Effect.fn('ApexLogService.getLogBody')(function* (logId: string) {
      return yield* connectionService.getConnection().pipe(
        Effect.flatMap(conn => fetchLogBody(conn, logId)),
        Effect.catchTag('ApexOperationError', error =>
          Effect.fail(
            new ApexLogBodyFetchError({ message: `Failed to fetch ApexLog body: ${error.message}`, cause: error })
          )
        )
      );
    });

    return {
      listLogs,
      getLogBody
    };
  })
}) {}
