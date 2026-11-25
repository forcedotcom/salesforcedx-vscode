/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  DebugLevelRecordSchema,
  TraceFlagLogType as ApexTraceFlagLogType,
  TraceFlagRecordSchema
} from '@salesforce/apex-node/effect';
import * as ParseResult from 'effect/ParseResult';
import * as Schema from 'effect/Schema';

export const TraceFlagLogType = ApexTraceFlagLogType;
export type TraceFlagLogType = typeof TraceFlagLogType.Type;

/** Pass-through for optional date strings; null/empty/whitespace → undefined so Date parse won't fail */
const dateStringOrUndefined = (s: string | null | undefined): string | undefined => (s?.trim() ? s : undefined);

/** Tooling API record shape from TraceFlag query. TracedEntityName is injected by getTraceFlags when resolving entity names. */
const ToolingTraceFlagRecordSchema = TraceFlagRecordSchema.pipe(
  Schema.omit('ExpirationDate'),
  Schema.extend(
    Schema.Struct({
      ExpirationDate: Schema.String,
      TracedEntityName: Schema.optionalWith(Schema.String, { nullable: true })
    })
  )
);

/** Client-facing TraceFlagItem shape. Shared with consuming extensions via services API. */
export const TraceFlagItemStruct = Schema.Struct({
  id: Schema.String,
  debugLevelId: Schema.optional(Schema.String),
  debugLevelName: Schema.optional(Schema.String),
  tracedEntityName: Schema.optional(Schema.String),
  tracedEntityId: Schema.optional(Schema.String),
  logType: TraceFlagLogType,
  startDate: Schema.optional(Schema.Date),
  expirationDate: Schema.Date,
  isActive: Schema.Boolean
});

/** Transforms Tooling API TraceFlag record → client-facing TraceFlagItem */
export const TraceFlagItemSchema = Schema.transformOrFail(ToolingTraceFlagRecordSchema, TraceFlagItemStruct, {
  strict: true,
  // Server representation => Client representation
  decode: rec =>
    ParseResult.succeed({
      id: rec.Id,
      debugLevelId: rec.DebugLevelId,
      debugLevelName: rec.DebugLevel?.DeveloperName,
      tracedEntityId: rec.TracedEntityId,
      tracedEntityName: rec.TracedEntityName,
      logType: rec.LogType,
      startDate: dateStringOrUndefined(rec.StartDate),
      expirationDate: rec.ExpirationDate,
      isActive: new Date(rec.ExpirationDate).getTime() > Date.now()
    }),
  // Client representation => Server representation
  encode: (_toI, _options, _ast, toA) =>
    ParseResult.decodeUnknown(ToolingTraceFlagRecordSchema)({
      Id: toA.id,
      LogType: toA.logType,
      ExpirationDate: toA.expirationDate.toISOString(),
      DebugLevelId: toA.debugLevelId,
      DebugLevel: toA.debugLevelName ? { DeveloperName: toA.debugLevelName } : undefined,
      TracedEntityId: toA.tracedEntityId,
      TracedEntityName: toA.tracedEntityName,
      StartDate: toA.startDate?.toISOString()
    })
});

export type TraceFlagItem = Schema.Schema.Type<typeof TraceFlagItemSchema>;

/** Tooling API record shape from DebugLevel query — https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/tooling_api_objects_debuglevel.htm */
const ToolingDebugLevelStruct = Schema.Struct({
  ...DebugLevelRecordSchema.fields,
  // Preserve string IDs in the Services API while validating against the shared wire schema.
  Id: Schema.transformOrFail(DebugLevelRecordSchema.fields.Id, Schema.String, {
    strict: true,
    decode: ParseResult.succeed,
    encode: ParseResult.decodeUnknown(DebugLevelRecordSchema.fields.Id)
  })
});

/** DebugLevel create payload — ToolingDebugLevelStruct without the server-assigned Id or Language. */
export const CreateDebugLevelStruct = ToolingDebugLevelStruct.pipe(Schema.omit('Id', 'Language'));

export type CreateDebugLevelPayload = Schema.Schema.Type<typeof CreateDebugLevelStruct>;

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
