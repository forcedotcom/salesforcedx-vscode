/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ParseError } from 'effect/ParseResult';
import * as Schema from 'effect/Schema';
import { ApexLogId, UserId } from '../../schemas/salesforceId';
import { ApexLogBodyFetchError, ApexLogQueryError } from './errors';
import { ApexLogRecordSchema } from './wire/logs';

const Timestamp = Schema.String.pipe(
  Schema.filter(value => Number.isFinite(Date.parse(value)), { jsonSchema: { format: 'date-time' } })
);

export const ListLogsOptionsSchema = Schema.mutable(
  Schema.Struct({
    /** Filter to logs for these users; pass one ID for a single user. */
    userId: Schema.optional(UserId),
    userIds: Schema.optional(Schema.mutable(Schema.Array(UserId))),
    /** Filter to logs whose Operation contains this string (e.g. 'executeAnonymous'). */
    operationContains: Schema.optional(Schema.String),
    /** Inclusive ISO StartTime lower bound. */
    startTimeAfter: Schema.optional(Timestamp),
    /** Cursor for incremental polling; omitting id includes all records at startTime. */
    cursor: Schema.optional(Schema.Struct({ startTime: Timestamp, id: Schema.optional(ApexLogId) })),
    /** Optional positive record limit. */
    limit: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
    /** Result ordering; defaults to descending, except cursor queries default to ascending. */
    orderBy: Schema.optional(Schema.Literal('ASC', 'DESC'))
  })
).annotations({ identifier: 'ListLogsOptions' });
/** Caller-facing wire form; decoding validates its user IDs as `UserId`. */
export type ListLogsOptions = Schema.Schema.Encoded<typeof ListLogsOptionsSchema>;
export type DecodedListLogsOptions = Schema.Schema.Type<typeof ListLogsOptionsSchema>;

const ApexLogCountSchema = Schema.Number.pipe(Schema.int(), Schema.positive()).annotations({
  identifier: 'ApexLogCount'
});
export const OptionalApexLogCountSchema = Schema.Union(ApexLogCountSchema, Schema.Undefined);

export const EffectApexLogGetOptionsSchema = Schema.Union(
  Schema.Struct({ logId: ApexLogId, numberOfLogs: Schema.optional(ApexLogCountSchema) }),
  Schema.Struct({ logId: Schema.optional(ApexLogId), numberOfLogs: ApexLogCountSchema })
).annotations({ identifier: 'EffectApexLogGetOptions' });
export type EffectApexLogGetOptions = Schema.Schema.Encoded<typeof EffectApexLogGetOptionsSchema>;

export const ApexLogResultSchema = Schema.Struct({
  logId: ApexLogId,
  log: Schema.String,
  logPath: Schema.optional(Schema.String)
}).annotations({ identifier: 'ApexLogResult' });
export type ApexLogResult = typeof ApexLogResultSchema.Type;

export const ApexLogWithBodySchema = Schema.Struct({
  record: ApexLogRecordSchema,
  log: Schema.String
}).annotations({ identifier: 'ApexLogWithBody' });
export type ApexLogWithBody = typeof ApexLogWithBodySchema.Type;

export const LogStreamEventSchema = Schema.Union(
  Schema.TaggedStruct('Log', { log: ApexLogRecordSchema, body: Schema.String }),
  Schema.TaggedStruct('QueryError', { error: Schema.Union(ApexLogQueryError, Schema.instanceOf(ParseError)) }),
  Schema.TaggedStruct('BodyError', { log: ApexLogRecordSchema, error: ApexLogBodyFetchError })
);
export type LogStreamEvent = typeof LogStreamEventSchema.Type;
