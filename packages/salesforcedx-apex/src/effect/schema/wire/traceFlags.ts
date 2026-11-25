/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { SalesforceId } from '../../../schemas/salesforceId';
import { DebugLevelId, TraceFlagId } from '../salesforceId';

/** TraceFlag.LogType values — https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/tooling_api_objects_traceflag.htm */
export const TraceFlagLogType = Schema.Literal('USER_DEBUG', 'DEVELOPER_LOG', 'CLASS_TRACING');
export type TraceFlagLogType = typeof TraceFlagLogType.Type;

/** Tooling API fields only; hosts own entity-name resolution and active-state presentation. */
export const TraceFlagRecordSchema = Schema.Struct({
  Id: TraceFlagId,
  LogType: TraceFlagLogType,
  StartDate: Schema.optionalWith(Schema.String, { nullable: true }),
  ExpirationDate: Schema.optionalWith(Schema.String, { nullable: true }),
  DebugLevelId: Schema.optionalWith(DebugLevelId, { nullable: true }),
  DebugLevel: Schema.optionalWith(
    Schema.Struct({ DeveloperName: Schema.optionalWith(Schema.String, { nullable: true }) }),
    { nullable: true }
  ),
  TracedEntityId: Schema.optionalWith(SalesforceId, { nullable: true })
}).annotations({ identifier: 'TraceFlagRecord' });
export type TraceFlagRecord = typeof TraceFlagRecordSchema.Type;

/** Fields needed to renew a flag; CLI accepts absent expiration dates. */
export const TraceFlagForEntitySchema = TraceFlagRecordSchema.pick(
  'Id',
  'StartDate',
  'ExpirationDate',
  'DebugLevelId',
  'DebugLevel'
).annotations({ identifier: 'TraceFlagForEntity' });
export type TraceFlagForEntity = typeof TraceFlagForEntitySchema.Type;

/** Cumulative verbosity shared by all DebugLevel categories: FINE includes DEBUG, INFO, WARN, and ERROR. https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/code_setting_debug_log_levels.htm */
export const LogCategoryLevel = Schema.Literal('NONE', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'FINE', 'FINER', 'FINEST');

/** null or a missing category decodes to NONE. */
const ToolingLogCategoryLevel = Schema.optionalWith(LogCategoryLevel, {
  nullable: true,
  default: () => 'NONE'
});

/** Tooling API DebugLevel record — https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/tooling_api_objects_debuglevel.htm */
export const DebugLevelRecordSchema = Schema.Struct({
  Id: DebugLevelId.pipe(Schema.annotations({ description: 'Salesforce record ID of the DebugLevel.' })),
  DeveloperName: Schema.String.pipe(Schema.annotations({ description: 'Unique API name for this debug level.' })),
  MasterLabel: Schema.String.pipe(Schema.annotations({ description: 'User-facing label for this debug level.' })),
  Language: Schema.NullOr(Schema.String).pipe(Schema.annotations({ description: 'Language of the MasterLabel.' })),
  ApexCode: ToolingLogCategoryLevel.annotations({
    description: 'Apex code execution: DML, SOQL/SOSL, triggers, and test methods.'
  }),
  ApexProfiling: ToolingLogCategoryLevel.annotations({
    description: 'Cumulative profiling info: namespace limits, emails sent.'
  }),
  Callout: ToolingLogCategoryLevel.annotations({
    description: 'Request-response XML from external web service and API calls.'
  }),
  Database: ToolingLogCategoryLevel.annotations({ description: 'DML statements and inline SOQL/SOSL queries.' }),
  Nba: ToolingLogCategoryLevel.annotations({ description: 'Einstein Next Best Action strategy execution.' }),
  System: ToolingLogCategoryLevel.annotations({ description: 'System method calls such as System.debug().' }),
  Validation: ToolingLogCategoryLevel.annotations({ description: 'Validation rule names and evaluation results.' }),
  Visualforce: ToolingLogCategoryLevel.annotations({
    description: 'Visualforce events, view state serialization/deserialization.'
  }),
  Wave: ToolingLogCategoryLevel.annotations({ description: 'CRM Analytics (Wave) logging.' }),
  Workflow: ToolingLogCategoryLevel.annotations({
    description: 'Workflow rules, flows, and process builder actions.'
  })
}).annotations({ identifier: 'DebugLevelRecord' });
export type DebugLevelRecord = typeof DebugLevelRecordSchema.Type;

/** Writes leave unspecified categories unchanged or at their server defaults. */
const DebugLevelCategoriesSchema = Schema.Struct({
  ApexCode: Schema.optional(LogCategoryLevel),
  ApexProfiling: Schema.optional(LogCategoryLevel),
  Callout: Schema.optional(LogCategoryLevel),
  Database: Schema.optional(LogCategoryLevel),
  Nba: Schema.optional(LogCategoryLevel),
  System: Schema.optional(LogCategoryLevel),
  Validation: Schema.optional(LogCategoryLevel),
  Visualforce: Schema.optional(LogCategoryLevel),
  Wave: Schema.optional(LogCategoryLevel),
  Workflow: Schema.optional(LogCategoryLevel)
});

export const CreateDebugLevelSchema = DebugLevelCategoriesSchema.pipe(
  Schema.extend(Schema.Struct({ DeveloperName: Schema.String, MasterLabel: Schema.String }))
).annotations({ identifier: 'CreateDebugLevel' });
export type CreateDebugLevel = typeof CreateDebugLevelSchema.Type;

export const UpdateDebugLevelSchema = DebugLevelCategoriesSchema.pipe(
  Schema.extend(
    Schema.Struct({
      DeveloperName: Schema.optional(Schema.String),
      MasterLabel: Schema.optional(Schema.String)
    })
  )
).annotations({ identifier: 'UpdateDebugLevel' });
export type UpdateDebugLevel = typeof UpdateDebugLevelSchema.Type;
