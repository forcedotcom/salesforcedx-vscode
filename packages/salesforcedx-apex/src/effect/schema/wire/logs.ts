/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { ApexLogId, UserId } from '../../../schemas/salesforceId.js';
import { QueryPageSchema } from '../queryPage.js';

/** ApexLog record from Tooling API query (Id, LogLength, StartTime, Status required per API reference). */
export const ApexLogListItem = Schema.Struct({
  Id: ApexLogId,
  Application: Schema.optional(Schema.NullOr(Schema.String)),
  DurationMilliseconds: Schema.optional(Schema.NullOr(Schema.Number)),
  LogLength: Schema.Number,
  LogUserId: Schema.optional(Schema.NullOr(UserId)),
  LogUser: Schema.optional(Schema.NullOr(Schema.Struct({ Name: Schema.optional(Schema.NullOr(Schema.String)) }))),
  Operation: Schema.optional(Schema.NullOr(Schema.String)),
  StartTime: Schema.String,
  Status: Schema.String
}).annotate({ identifier: 'ApexLogListItem' });
export type ApexLogListItem = typeof ApexLogListItem.Type;

export const ApexLogPageSchema = QueryPageSchema(ApexLogListItem).annotate({ identifier: 'ApexLogPage' });
