/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import * as SchemaGetter from 'effect/SchemaGetter';
import * as Struct from 'effect/Struct';
import { optionalToolingField } from './toolingFields.js';

/** TraceFlag.LogType values from the Tooling API. */
export const TraceFlagLogType = Schema.Literals(['USER_DEBUG', 'DEVELOPER_LOG', 'CLASS_TRACING']);
export type TraceFlagLogType = typeof TraceFlagLogType.Type;
export const ToolingTraceFlagRecordSchema = Schema.Struct({
  Id: Schema.String,
  LogType: TraceFlagLogType,
  StartDate: optionalToolingField(Schema.String),
  ExpirationDate: Schema.String,
  DebugLevelId: optionalToolingField(Schema.String),
  DebugLevel: optionalToolingField(Schema.Struct({ DeveloperName: optionalToolingField(Schema.String) })),
  TracedEntityId: optionalToolingField(Schema.String),
  TracedEntityName: optionalToolingField(Schema.String)
});
export const TraceFlagItemStruct = Schema.Struct({
  id: Schema.String,
  debugLevelId: Schema.optional(Schema.String),
  debugLevelName: Schema.optional(Schema.String),
  tracedEntityName: Schema.optional(Schema.String),
  tracedEntityId: Schema.optional(Schema.String),
  logType: TraceFlagLogType,
  startDate: Schema.optional(Schema.DateFromString),
  expirationDate: Schema.DateFromString,
  isActive: Schema.Boolean
});
/** Preserve wire null/blank start dates and JavaScript Date parsing/encoding from the V3 decoder. */
export const TraceFlagItemSchema = ToolingTraceFlagRecordSchema.pipe(
  Schema.decodeTo(Schema.toType(TraceFlagItemStruct), {
    decode: SchemaGetter.transform(record => ({
      id: record.Id,
      debugLevelId: record.DebugLevelId,
      debugLevelName: record.DebugLevel?.DeveloperName,
      tracedEntityId: record.TracedEntityId,
      tracedEntityName: record.TracedEntityName,
      logType: record.LogType,
      startDate: record.StartDate?.trim() ? new Date(record.StartDate) : undefined,
      expirationDate: new Date(record.ExpirationDate),
      isActive: new Date(record.ExpirationDate).getTime() > Date.now()
    })),
    encode: SchemaGetter.transform(item => ({
      Id: item.id,
      LogType: item.logType,
      ExpirationDate: item.expirationDate.toISOString(),
      DebugLevelId: item.debugLevelId,
      DebugLevel: item.debugLevelName ? { DeveloperName: item.debugLevelName } : undefined,
      TracedEntityId: item.tracedEntityId,
      TracedEntityName: item.tracedEntityName,
      StartDate: item.startDate?.toISOString()
    }))
  })
);
export type TraceFlagItem = typeof TraceFlagItemSchema.Type;
const LogCategoryLevel = Schema.Literals(['NONE', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'FINE', 'FINER', 'FINEST']);
/** Null or missing Tooling categories default to NONE, without coercing other values. */
const ToolingLogCategoryLevel = optionalToolingField(LogCategoryLevel).pipe(
  Schema.decodeTo(LogCategoryLevel, {
    decode: SchemaGetter.transformOptional(value => Option.some(Option.getOrElse(value, () => undefined) ?? 'NONE')),
    encode: SchemaGetter.transform(value => value)
  })
);
export const ToolingDebugLevelStruct = Schema.Struct({
  Id: Schema.String,
  DeveloperName: Schema.String,
  MasterLabel: Schema.String,
  Language: Schema.NullOr(Schema.String),
  ApexCode: ToolingLogCategoryLevel,
  ApexProfiling: ToolingLogCategoryLevel,
  Callout: ToolingLogCategoryLevel,
  Database: ToolingLogCategoryLevel,
  Nba: ToolingLogCategoryLevel,
  System: ToolingLogCategoryLevel,
  Validation: ToolingLogCategoryLevel,
  Visualforce: ToolingLogCategoryLevel,
  Wave: ToolingLogCategoryLevel,
  Workflow: ToolingLogCategoryLevel
});
export const CreateDebugLevelStruct = ToolingDebugLevelStruct.mapFields(Struct.omit(['Id', 'Language']));
export type CreateDebugLevelPayload = typeof CreateDebugLevelStruct.Type;
const fields = ToolingDebugLevelStruct.fields;
export const DebugLevelItemSchema = Schema.Struct({
  id: fields.Id,
  developerName: fields.DeveloperName,
  masterLabel: fields.MasterLabel,
  language: fields.Language,
  apexCode: fields.ApexCode,
  apexProfiling: fields.ApexProfiling,
  callout: fields.Callout,
  database: fields.Database,
  nba: fields.Nba,
  system: fields.System,
  validation: fields.Validation,
  visualforce: fields.Visualforce,
  wave: fields.Wave,
  workflow: fields.Workflow
}).pipe(
  Schema.encodeKeys({
    id: 'Id',
    developerName: 'DeveloperName',
    masterLabel: 'MasterLabel',
    language: 'Language',
    apexCode: 'ApexCode',
    apexProfiling: 'ApexProfiling',
    callout: 'Callout',
    database: 'Database',
    nba: 'Nba',
    system: 'System',
    validation: 'Validation',
    visualforce: 'Visualforce',
    wave: 'Wave',
    workflow: 'Workflow'
  })
);
export type DebugLevelItem = typeof DebugLevelItemSchema.Type;
