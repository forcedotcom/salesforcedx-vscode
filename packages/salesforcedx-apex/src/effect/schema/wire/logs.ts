/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { ApexLogId, UserId } from '../../../schemas/salesforceId';

/** Combined CLI and services Tooling API fields. */
export const ApexLogRecordSchema = Schema.Struct({
  Id: ApexLogId,
  Application: Schema.optionalWith(Schema.String, { nullable: true }),
  DurationMilliseconds: Schema.optionalWith(Schema.Number, { nullable: true }),
  Location: Schema.optionalWith(Schema.String, { nullable: true }),
  LogLength: Schema.Number,
  LogUserId: Schema.optionalWith(UserId, { nullable: true }),
  LogUser: Schema.optionalWith(
    Schema.Struct({
      Name: Schema.optionalWith(Schema.String, { nullable: true }),
      attributes: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
    }),
    { nullable: true }
  ),
  Operation: Schema.optionalWith(Schema.String, { nullable: true }),
  Request: Schema.optionalWith(Schema.String, { nullable: true }),
  StartTime: Schema.String,
  Status: Schema.String
}).annotations({ identifier: 'ApexLogRecord' });
export type ApexLogRecord = typeof ApexLogRecordSchema.Type;

/** ApexLog record from Tooling API query (Id, LogLength, StartTime, Status required per API reference). */
export const ApexLogListItem = Schema.Struct({
  Id: ApexLogId,
  Application: Schema.optionalWith(Schema.String, { nullable: true }),
  DurationMilliseconds: Schema.optionalWith(Schema.Number, { nullable: true }),
  LogLength: Schema.Number,
  LogUserId: Schema.optionalWith(UserId, { nullable: true }),
  LogUser: Schema.optionalWith(Schema.Struct({ Name: Schema.optionalWith(Schema.String, { nullable: true }) }), {
    nullable: true
  }),
  Operation: Schema.optionalWith(Schema.String, { nullable: true }),
  StartTime: Schema.String,
  Status: Schema.String
}).annotations({ identifier: 'ApexLogListItem' });
export type ApexLogListItem = typeof ApexLogListItem.Type;
