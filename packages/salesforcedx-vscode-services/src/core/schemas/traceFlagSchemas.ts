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
const ToolingTraceFlagRecordSchema = Schema.Struct({
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
export const TraceFlagItemSchema = Schema.transform(ToolingTraceFlagRecordSchema, TraceFlagItemStruct, {
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
});

export type TraceFlagItem = Schema.Schema.Type<typeof TraceFlagItemSchema>;

/** Log category verbosity levels — shared across all DebugLevel category fields. Cumulative: selecting FINE includes all events at DEBUG, INFO, WARN, and ERROR. https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/code_setting_debug_log_levels.htm */
const LogCategoryLevel = Schema.Literal('NONE', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'FINE', 'FINER', 'FINEST');

/** Accepts LogCategoryLevel, null, or undefined from Tooling API; outputs LogCategoryLevel (null/undefined → 'NONE'). */
const ToolingLogCategoryLevel = Schema.NullishOr(LogCategoryLevel).pipe(
  Schema.transform(LogCategoryLevel, { decode: v => v ?? 'NONE', encode: v => v })
);

/** Tooling API record shape from DebugLevel query — https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/tooling_api_objects_debuglevel.htm */
export const ToolingDebugLevelStruct = Schema.Struct({
  Id: Schema.String.pipe(Schema.annotations({ description: 'Salesforce record ID of the DebugLevel.' })),
  DeveloperName: Schema.String.pipe(Schema.annotations({ description: 'Unique API name for this debug level.' })),
  MasterLabel: Schema.String.pipe(Schema.annotations({ description: 'User-facing label for this debug level.' })),
  Language: NullableString.pipe(Schema.annotations({ description: 'Language of the MasterLabel.' })),
  ApexCode: ToolingLogCategoryLevel.pipe(
    Schema.annotations({ description: 'Apex code execution: DML, SOQL/SOSL, triggers, and test methods.' })
  ),
  ApexProfiling: ToolingLogCategoryLevel.pipe(
    Schema.annotations({ description: 'Cumulative profiling info: namespace limits, emails sent.' })
  ),
  Callout: ToolingLogCategoryLevel.pipe(
    Schema.annotations({ description: 'Request-response XML from external web service and API calls.' })
  ),
  Database: ToolingLogCategoryLevel.pipe(
    Schema.annotations({ description: 'DML statements and inline SOQL/SOSL queries.' })
  ),
  Nba: ToolingLogCategoryLevel.pipe(
    Schema.annotations({ description: 'Einstein Next Best Action strategy execution.' })
  ),
  System: ToolingLogCategoryLevel.pipe(
    Schema.annotations({ description: 'System method calls such as System.debug().' })
  ),
  Validation: ToolingLogCategoryLevel.pipe(
    Schema.annotations({ description: 'Validation rule names and evaluation results.' })
  ),
  Visualforce: ToolingLogCategoryLevel.pipe(
    Schema.annotations({ description: 'Visualforce events, view state serialization/deserialization.' })
  ),
  Wave: ToolingLogCategoryLevel.pipe(Schema.annotations({ description: 'CRM Analytics (Wave) logging.' })),
  Workflow: ToolingLogCategoryLevel.pipe(
    Schema.annotations({ description: 'Workflow rules, flows, and process builder actions.' })
  )
});

export type ToolingDebugLevelRecord = Schema.Schema.Type<typeof ToolingDebugLevelStruct>;

/** Client-facing DebugLevelItem: PascalCase → camelCase via rename. */
export const DebugLevelItemSchema = Schema.rename(ToolingDebugLevelStruct, {
  Id: 'id',
  DeveloperName: 'developerName',
  MasterLabel: 'masterLabel',
  Language: 'language',
  ApexCode: 'apexCode',
  ApexProfiling: 'apexProfiling',
  Callout: 'callout',
  Database: 'database',
  Nba: 'nba',
  System: 'system',
  Validation: 'validation',
  Visualforce: 'visualforce',
  Wave: 'wave',
  Workflow: 'workflow'
});

export type DebugLevelItem = Schema.Schema.Type<typeof DebugLevelItemSchema>;
