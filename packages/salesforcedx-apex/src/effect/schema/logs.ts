/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { ApexLogBodyFetchError, ApexLogQueryError } from './errors.js';
import { ApexLogId, UserId } from './salesforceId.js';
import { ApexLogListItem, ApexLogRecordSchema } from './wire/logs.js';

export const ListLogsOptionsSchema = Schema.Struct({
  /** Filter to logs for these users; pass one ID for a single user. */
  userId: Schema.optional(UserId),
  userIds: Schema.Array(UserId).pipe(Schema.mutable, Schema.optional),
  /** Filter to logs whose Operation contains this string (e.g. 'executeAnonymous'). */
  operationContains: Schema.optional(Schema.String),
  /** Inclusive ISO StartTime lower bound. */
  startTimeAfter: Schema.optional(Schema.String),
  /** Cursor for incremental polling; omitting id includes all records at startTime. */
  cursor: Schema.optional(Schema.Struct({ startTime: Schema.String, id: Schema.optional(ApexLogId) })),
  /** Optional positive record limit. */
  limit: Schema.optional(Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0))),
  /** Result ordering; defaults to descending, except cursor queries default to ascending. */
  orderBy: Schema.optional(Schema.Literals(['ASC', 'DESC']))
}).annotate({ identifier: 'ListLogsOptions' });
/** Caller-facing wire form; decoding validates its user IDs as `UserId`. */
export type ListLogsOptions = Schema.Codec.Encoded<typeof ListLogsOptionsSchema>;
export type DecodedListLogsOptions = Schema.Schema.Type<typeof ListLogsOptionsSchema>;

const ApexLogCountSchema = Schema.Number.check(Schema.isInt(), Schema.isGreaterThan(0)).annotate({
  identifier: 'ApexLogCount'
});
export const OptionalApexLogCountSchema = Schema.Union([ApexLogCountSchema, Schema.Undefined]);

export const EffectApexLogGetOptionsSchema = Schema.Union([
  Schema.Struct({ logId: ApexLogId, numberOfLogs: Schema.optional(ApexLogCountSchema) }),
  Schema.Struct({ logId: Schema.optional(ApexLogId), numberOfLogs: ApexLogCountSchema })
]).annotate({ identifier: 'EffectApexLogGetOptions' });
export type EffectApexLogGetOptions = Schema.Codec.Encoded<typeof EffectApexLogGetOptionsSchema>;

export const ApexLogResultSchema = Schema.Struct({
  logId: ApexLogId,
  log: Schema.String,
  logPath: Schema.optional(Schema.String)
}).annotate({ identifier: 'ApexLogResult' });
export type ApexLogResult = typeof ApexLogResultSchema.Type;

export const ApexLogWithBodySchema = Schema.Struct({
  record: ApexLogRecordSchema,
  log: Schema.String
}).annotate({ identifier: 'ApexLogWithBody' });
export type ApexLogWithBody = typeof ApexLogWithBodySchema.Type;

export const LogStreamEventSchema = Schema.Union([
  Schema.TaggedStruct('Log', { log: ApexLogListItem, body: Schema.String }),
  Schema.TaggedStruct('QueryError', {
    error: Schema.Union([ApexLogQueryError, Schema.instanceOf(Schema.SchemaError)])
  }),
  Schema.TaggedStruct('BodyError', { log: ApexLogListItem, error: ApexLogBodyFetchError })
]);
export type LogStreamEvent = typeof LogStreamEventSchema.Type;
