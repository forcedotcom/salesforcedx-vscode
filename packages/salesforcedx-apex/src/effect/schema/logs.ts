/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ParseError } from 'effect/ParseResult';
import * as Schema from 'effect/Schema';
import { ApexLogBodyFetchError, ApexLogQueryError } from './errors';
import { ApexLogListItem } from './wire/logs';

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

export const LogStreamEventSchema = Schema.Union(
  Schema.TaggedStruct('Log', { log: ApexLogListItem, body: Schema.String }),
  Schema.TaggedStruct('QueryError', { error: Schema.Union(ApexLogQueryError, Schema.instanceOf(ParseError)) }),
  Schema.TaggedStruct('BodyError', { log: ApexLogListItem, error: ApexLogBodyFetchError })
);
export type LogStreamEvent = typeof LogStreamEventSchema.Type;
