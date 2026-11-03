/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { isNull } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import * as SchemaGetter from 'effect/SchemaGetter';
import { QueryPageSchema } from '../queryPage.js';
import { ApexLogId, UserId } from '../salesforceId.js';

const LogUserSchema = Schema.Struct({ Name: Schema.String.pipe(Schema.NullOr, Schema.optional) });
const OptionalLogUserSchema = Schema.NullOr(LogUserSchema).pipe(
  Schema.decodeTo(Schema.UndefinedOr(LogUserSchema), {
    decode: SchemaGetter.transform(value => (isNull(value) ? undefined : value)),
    encode: SchemaGetter.transform(value => value ?? null)
  })
);

/** ApexLog record from Tooling API query (Id, LogLength, StartTime, Status required per API reference). */
export const ApexLogListItem = Schema.Struct({
  Id: ApexLogId,
  Application: Schema.optional(Schema.NullOr(Schema.String)),
  DurationMilliseconds: Schema.optional(Schema.NullOr(Schema.Number)),
  LogLength: Schema.Number,
  LogUserId: Schema.optional(Schema.NullOr(UserId)),
  LogUser: Schema.optional(OptionalLogUserSchema),
  Operation: Schema.optional(Schema.NullOr(Schema.String)),
  StartTime: Schema.String,
  Status: Schema.String
}).annotate({ identifier: 'ApexLogListItem' });
export type ApexLogListItem = typeof ApexLogListItem.Type;

export const ApexLogPageSchema = QueryPageSchema(ApexLogListItem).annotate({ identifier: 'ApexLogPage' });
