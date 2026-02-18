/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

/** Pass-through for optional date strings; null/empty/whitespace → undefined so Date parse won't fail */
const dateStringOrUndefined = (s: string | null | undefined): string | undefined => (s?.trim() ? s : undefined);

/** Tooling API returns null for missing fields; Schema.optional only handles undefined. This handles both. */
const NullableString = Schema.Union(Schema.String, Schema.Null);

/** TraceFlag.LogType enum per Tooling API — https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/tooling_api_objects_traceflag.htm */
export const TraceFlagLogType = Schema.Literal('USER_DEBUG', 'DEVELOPER_LOG', 'CLASS_TRACING');
export type TraceFlagLogType = Schema.Schema.Type<typeof TraceFlagLogType>;

/** Tooling API record shape from TraceFlag query. TracedEntityName is injected by getTraceFlags when resolving entity names. */
export const ToolingTraceFlagRecordSchema = Schema.Struct({
  Id: Schema.String,
  LogType: TraceFlagLogType,
  StartDate: Schema.optional(NullableString),
  ExpirationDate: Schema.String,
  DebugLevelId: Schema.optional(NullableString),
  TracedEntityId: Schema.optional(NullableString),
  TracedEntityName: Schema.optional(NullableString)
});

export type ToolingTraceFlagRecord = Schema.Schema.Type<typeof ToolingTraceFlagRecordSchema>;

/** Client-facing TraceFlagItem shape. Shared with consuming extensions via services API. */
export const TraceFlagItemStruct = Schema.Struct({
  id: Schema.String,
  debugLevelId: Schema.optional(Schema.String),
  tracedEntityName: Schema.optional(Schema.String),
  tracedEntityId: Schema.optional(Schema.String),
  logType: TraceFlagLogType,
  startDate: Schema.optional(Schema.Date),
  expirationDate: Schema.Date,
  isActive: Schema.Boolean
});

/** Transforms Tooling API TraceFlag record → client-facing TraceFlagItem */
export const TraceFlagItemSchema = Schema.transform(
  ToolingTraceFlagRecordSchema,
  TraceFlagItemStruct,
  {
    strict: true,
    // Server representation => Client representation
    decode: rec => ({
      id: rec.Id,
      debugLevelId: rec.DebugLevelId ?? undefined,
      tracedEntityId: rec.TracedEntityId ?? undefined,
      tracedEntityName: rec.TracedEntityName ?? undefined,
      logType: rec.LogType,
      startDate: dateStringOrUndefined(rec.StartDate),
      expirationDate: rec.ExpirationDate,
      isActive: new Date(rec.ExpirationDate).getTime() > Date.now()
    }),
    // Client representation => Server representation
    encode: (_toI, toA) => ({
      Id: toA.id,
      LogType: toA.logType,
      ExpirationDate: toA.expirationDate.toISOString(),
      DebugLevelId: toA.debugLevelId,
      TracedEntityId: toA.tracedEntityId,
      TracedEntityName: toA.tracedEntityName,
      StartDate: toA.startDate?.toISOString()
    })
  }
);

export type TraceFlagItem = Schema.Schema.Type<typeof TraceFlagItemSchema>;
