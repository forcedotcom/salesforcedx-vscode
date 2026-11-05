/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ConnectionError } from './connectionService.js';
import type { QueryPageError } from './queryService.js';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { optionalToolingField } from './toolingFields.js';

/** Wire IDs remain strings, as in the existing ApexLog API decoder. */
export const ApexLogListItem = Schema.Struct({
  Id: Schema.String,
  Application: optionalToolingField(Schema.String),
  DurationMilliseconds: optionalToolingField(Schema.Number),
  LogLength: Schema.Number,
  LogUserId: optionalToolingField(Schema.String),
  LogUser: optionalToolingField(Schema.Struct({ Name: optionalToolingField(Schema.String) })),
  Operation: optionalToolingField(Schema.String),
  StartTime: Schema.String,
  Status: Schema.String
});
export type ApexLogListItem = typeof ApexLogListItem.Type;
export type ListLogsOptions = {
  /** Ignored when userIds is nonempty. */
  readonly userId?: string;
  readonly userIds?: string[];
  readonly operationContains?: string;
  readonly startTimeAfter?: string;
};
export class ApexLogBodyFetchError extends Schema.TaggedError<ApexLogBodyFetchError>()('ApexLogBodyFetchError', {
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown)
}) {}
export class ApexLogService extends Context.Service<
  ApexLogService,
  {
    readonly listLogs: (
      limit?: number,
      options?: ListLogsOptions
    ) => Effect.Effect<readonly ApexLogListItem[], ConnectionError | QueryPageError | Schema.SchemaError>;
    readonly getLogBody: (logId: string) => Effect.Effect<string, ConnectionError | ApexLogBodyFetchError>;
  }
>()('@salesforce/vscode-services/v2/ApexLogService') {}
