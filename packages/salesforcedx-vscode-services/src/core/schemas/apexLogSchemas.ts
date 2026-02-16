/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

const LogUserSchema = Schema.Struct({
  Name: Schema.optional(Schema.String)
});

/** API record shape from Tooling QueryResult (ApexLog) */
const ApexLogQueryRecordSchema = Schema.Struct({
  Id: Schema.String,
  Application: Schema.optional(Schema.String),
  DurationMilliseconds: Schema.optional(Schema.Number),
  LogLength: Schema.optional(Schema.Number),
  LogUser: Schema.optional(LogUserSchema),
  Operation: Schema.optional(Schema.String),
  StartTime: Schema.optional(Schema.String),
  Status: Schema.optional(Schema.String)
});

export type ApexLogListItem = Schema.Schema.Type<typeof ApexLogListItemSchema>;

/** Pass-through for Schema.optional(Schema.Date); empty string -> undefined so parse won't fail */
const startTimeEncoded = (s: string | undefined): string | undefined => (s?.trim() ? s : undefined);

/** Normalized log list item with required fields and defaults */
export const ApexLogListItemSchema = Schema.transform(
  ApexLogQueryRecordSchema,
  Schema.Struct({
    id: Schema.String,
    Application: Schema.String,
    DurationMilliseconds: Schema.Number,
    LogLength: Schema.Number,
    LogUser: Schema.optional(LogUserSchema),
    Operation: Schema.String,
    StartTime: Schema.optional(Schema.Date),
    Status: Schema.String
  }),
  {
    strict: true,
    decode: r => ({
      id: r.Id,
      Application: r.Application ?? 'Unknown',
      DurationMilliseconds: r.DurationMilliseconds ?? 0,
      LogLength: r.LogLength ?? 0,
      LogUser: r.LogUser,
      Operation: r.Operation ?? 'Api',
      StartTime: startTimeEncoded(r.StartTime),
      Status: r.Status ?? ''
    }),
    encode: (_toI, toA) => ({
      Id: toA.id,
      Application: toA.Application,
      DurationMilliseconds: toA.DurationMilliseconds,
      LogLength: toA.LogLength,
      LogUser: toA.LogUser,
      Operation: toA.Operation,
      StartTime: toA.StartTime?.toISOString(),
      Status: toA.Status
    })
  }
);
