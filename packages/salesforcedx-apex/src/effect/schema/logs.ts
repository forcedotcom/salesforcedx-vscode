/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ParseError } from 'effect/ParseResult';
import * as Schema from 'effect/Schema';
import { SalesforceId, UserId } from '../../schemas/salesforceId';
import { ApexLogBodyFetchError, ApexLogQueryError } from './errors';
import { ApexLogListItem } from './wire/logs';

export const ListLogsOptionsSchema = Schema.mutable(
  Schema.Struct({
    /** Filter to logs for these users; pass one ID for a single user. */
    userIds: Schema.optional(Schema.mutable(Schema.Array(UserId))),
    /** Filter to logs whose Operation contains this string (e.g. 'executeAnonymous'). */
    operationContains: Schema.optional(Schema.String),
    /** Inclusive ISO StartTime lower bound. */
    startTimeAfter: Schema.optional(Schema.String),
    /** Cursor for incremental polling; omitting id includes all records at startTime. */
    cursor: Schema.optional(Schema.Struct({ startTime: Schema.String, id: Schema.optional(SalesforceId) })),
    /** Result ordering; defaults to descending, except cursor queries default to ascending. */
    orderBy: Schema.optional(Schema.Literal('ASC', 'DESC'))
  })
).annotations({ identifier: 'ListLogsOptions' });
/** Caller-facing wire form; decoding validates its user IDs as `UserId`. */
export type ListLogsOptions = Schema.Schema.Encoded<typeof ListLogsOptionsSchema>;
export type DecodedListLogsOptions = Schema.Schema.Type<typeof ListLogsOptionsSchema>;

export const LogStreamEventSchema = Schema.Union(
  Schema.TaggedStruct('Log', { log: ApexLogListItem, body: Schema.String }),
  Schema.TaggedStruct('QueryError', { error: Schema.Union(ApexLogQueryError, Schema.instanceOf(ParseError)) }),
  Schema.TaggedStruct('BodyError', { log: ApexLogListItem, error: ApexLogBodyFetchError })
);
export type LogStreamEvent = typeof LogStreamEventSchema.Type;
