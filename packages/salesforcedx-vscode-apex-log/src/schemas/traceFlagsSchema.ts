/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Either from 'effect/Either';
import * as Schema from 'effect/Schema';

/** Apex debug level verbosity */
export const DebugLevelSchema = Schema.Literal(
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

export type DebugLevel = Schema.Schema.Type<typeof DebugLevelSchema>;

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

  /** Schema for .sf/orgs/{orgId}/traceFlags.json - used for decode/encode and JSON Schema generation. traceFlags grouped by logType, active only. */
  const TraceFlagsConfigSchema = Schema.Struct({
    defaultDebugLevels: Schema.optional(Schema.Record({ key: Schema.String, value: DebugLevelSchema })),
    defaultDurationMinutes: Schema.optional(Schema.Number),
    traceFlags: Schema.optional(TraceFlagsByLogTypeSchema)
  }).pipe(Schema.annotations({ jsonSchema: { title: 'Trace Flags Configuration' } }));

  /** Encodes TraceFlagsConfig to JSON string (pretty-printed). */
  const encodeTraceFlagsConfigToJson = (config: Schema.Schema.Type<typeof TraceFlagsConfigSchema>): string =>
    JSON.stringify(Schema.encodeSync(TraceFlagsConfigSchema)(config), undefined, 2);

  /** Decodes TraceFlagsConfig from JSON string. Returns undefined on invalid JSON or schema mismatch. */
  const decodeTraceFlagsConfigFromJson = (json: string): Schema.Schema.Type<typeof TraceFlagsConfigSchema> | undefined =>
    Either.getOrElse(Schema.decodeUnknownEither(Schema.parseJson(TraceFlagsConfigSchema))(json), () => undefined);

  return { TraceFlagsConfigSchema, encodeTraceFlagsConfigToJson, decodeTraceFlagsConfigFromJson };
};
