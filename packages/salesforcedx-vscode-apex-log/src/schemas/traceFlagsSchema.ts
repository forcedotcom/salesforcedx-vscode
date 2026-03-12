/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Either from 'effect/Either';
import * as Schema from 'effect/Schema';

/** Apex debug level verbosity */
const DebugLevelSchema = Schema.Literal(
  'NONE',
  'INTERNAL',
  'FINEST',
  'FINER',
  'FINE',
  'DEBUG',
  'INFO',
  'WARN',
  'ERROR'
);

/** Log category verbosity — NONE through FINEST (cumulative). */
const LogCategoryLevel = Schema.Literal('NONE', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'FINE', 'FINER', 'FINEST');

/** Shape for DebugLevel items in the JSON file (camelCase, all fields). https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/tooling_api_objects_debuglevel.htm */
const DebugLevelItemStruct = Schema.Struct({
  id: Schema.String.pipe(Schema.annotations({ description: 'Salesforce record ID of the DebugLevel.' })),
  developerName: Schema.String.pipe(Schema.annotations({ description: 'Unique API name for this debug level.' })),
  masterLabel: Schema.String.pipe(Schema.annotations({ description: 'User-facing label for this debug level.' })),
  language: Schema.NullOr(Schema.String).pipe(Schema.annotations({ description: 'Language of the MasterLabel.' })),
  apexCode: LogCategoryLevel.pipe(Schema.annotations({ description: 'Apex code execution: DML, SOQL/SOSL, triggers, and test methods.' })),
  apexProfiling: LogCategoryLevel.pipe(Schema.annotations({ description: 'Cumulative profiling info: namespace limits, emails sent.' })),
  callout: LogCategoryLevel.pipe(Schema.annotations({ description: 'Request-response XML from external web service and API calls.' })),
  database: LogCategoryLevel.pipe(Schema.annotations({ description: 'DML statements and inline SOQL/SOSL queries.' })),
  nba: LogCategoryLevel.pipe(Schema.annotations({ description: 'Einstein Next Best Action strategy execution.' })),
  system: LogCategoryLevel.pipe(Schema.annotations({ description: 'System method calls such as System.debug().' })),
  validation: LogCategoryLevel.pipe(Schema.annotations({ description: 'Validation rule names and evaluation results.' })),
  visualforce: LogCategoryLevel.pipe(Schema.annotations({ description: 'Visualforce events, view state serialization/deserialization.' })),
  wave: LogCategoryLevel.pipe(Schema.annotations({ description: 'CRM Analytics (Wave) logging.' })),
  workflow: LogCategoryLevel.pipe(Schema.annotations({ description: 'Workflow rules, flows, and process builder actions.' }))
});

/** TraceFlagItem + debugLevelName. Apex-log enriches from DebugLevel lookup. Kept optional for defensive parsing. */
export const buildExtendedTraceFlagItemStruct = <A, I>(base: Schema.Schema<A, I, never>) =>
  base.pipe(Schema.extend(Schema.Struct({ debugLevelName: Schema.optional(Schema.String) })));

/** Build trace-flags JSON schemas from the shared TraceFlagItemStruct (provided by services API at runtime, or directly in build scripts). */
export const buildTraceFlagsSchemas = <A, I>(itemStruct: Schema.Schema<A, I, never>) => {
  const TraceFlagsByLogTypeSchema = Schema.Struct({
    DEVELOPER_LOG: Schema.optional(
      Schema.Array(itemStruct).pipe(
        Schema.annotations({
          description: 'Standard debug logs for users. Captures Apex execution, database operations, and system events.'
        })
      )
    ),
    USER_DEBUG: Schema.optional(
      Schema.Array(itemStruct).pipe(
        Schema.annotations({
          description: 'User debug statements (System.debug). Captures output from Debug.log() and similar.'
        })
      )
    ),
    CLASS_TRACING: Schema.optional(
      Schema.Array(itemStruct).pipe(
        Schema.annotations({
          description: 'Apex class execution traces. Used for profiling and debugging specific classes.'
        })
      )
    ),
    TRIGGERS: Schema.optional(
      Schema.Array(itemStruct).pipe(
        Schema.annotations({ description: 'Apex trigger execution traces. TracedEntityId prefix 01q.' })
      )
    ),
    OTHER: Schema.optional(
      Schema.Array(itemStruct).pipe(Schema.annotations({ description: 'Other trace flag types.' }))
    )
  });

  /** Schema for trace flags virtual doc - used for decode/encode and JSON Schema generation. traceFlags grouped by logType, active only. defaultDurationMinutes now in workspace config. */
  const TraceFlagsConfigSchema = Schema.Struct({
    defaultDebugLevels: Schema.optional(Schema.Record({ key: Schema.String, value: DebugLevelSchema })),
    traceFlags: Schema.optional(TraceFlagsByLogTypeSchema),
    debugLevels: Schema.optional(
      Schema.Array(DebugLevelItemStruct).pipe(
        Schema.annotations({ description: 'All DebugLevel records from the org.' })
      )
    )
  }).pipe(Schema.annotations({ jsonSchema: { title: 'Trace Flags Configuration' } }));

  /** Encodes TraceFlagsConfig to JSON string (pretty-printed). */
  const encodeTraceFlagsConfigToJson = (config: Schema.Schema.Type<typeof TraceFlagsConfigSchema>): string =>
    JSON.stringify(Schema.encodeSync(TraceFlagsConfigSchema)(config), undefined, 2);

  /** Decodes TraceFlagsConfig from JSON string. Returns undefined on invalid JSON or schema mismatch. */
  const decodeTraceFlagsConfigFromJson = (json: string): Schema.Schema.Type<typeof TraceFlagsConfigSchema> | undefined =>
    Either.getOrElse(Schema.decodeUnknownEither(Schema.parseJson(TraceFlagsConfigSchema))(json), () => undefined);

  return { TraceFlagsConfigSchema, encodeTraceFlagsConfigToJson, decodeTraceFlagsConfigFromJson };
};
