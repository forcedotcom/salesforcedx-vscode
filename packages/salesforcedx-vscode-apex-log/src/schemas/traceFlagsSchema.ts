/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

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

/** Salesforce ID: 3-char prefix + 12 base (+ optional 3-char suffix for 18-char) */
const salesforceIdPattern = (prefix: string) => new RegExp(`^${prefix}[a-zA-Z0-9]{12}([a-zA-Z0-9]{3})?$`);

/** TraceFlag object prefix (7tf) - https://force-center.com/idprefixes */
const TraceFlagIdSchema = Schema.String.pipe(
  Schema.pattern(salesforceIdPattern('7tf'), { description: 'TraceFlag Id (prefix 7tf)' })
);

/** TracedEntityId: User (005), ApexClass (01p), ApexTrigger (01q) */
const TracedEntityIdSchema = Schema.String.pipe(
  Schema.pattern(salesforceIdPattern('(005|01p|01q)'), {
    description: 'User (005), ApexClass (01p), or ApexTrigger (01q) Id'
  })
);

/** Optional date: reject empty/whitespace; Tooling API StartDate/ExpirationDate are optional */
const OptionalDateSchema = Schema.optional(
  Schema.String.pipe(
    Schema.filter((s): s is string => s.trim().length > 0, { message: () => 'date must be non-empty if provided' })
  ).pipe(
    Schema.transform(Schema.Date, {
      strict: true,
      decode: fromA => fromA,
      encode: (_toI, toA) => toA.toISOString()
    })
  )
);

/** Schema for traceFlags.json items (strings in file, Date in app) */
const TraceFlagItemSchema = Schema.Struct({
  id: Schema.optional(TraceFlagIdSchema),
  tracedEntityName: Schema.optional(Schema.String),
  tracedEntityId: Schema.optional(TracedEntityIdSchema),
  logType: Schema.optional(Schema.Literal('DEVELOPER_LOG')),
  startDate: OptionalDateSchema,
  expirationDate: OptionalDateSchema,
  isActive: Schema.optional(Schema.Boolean)
});

export type TraceFlagItem = Schema.Schema.Type<typeof TraceFlagItemSchema>;

/** Schema for .sf/orgs/{orgId}/traceFlags.json - used for decode/encode and JSON Schema generation */
export const TraceFlagsConfigSchema = Schema.Struct({
  defaultDebugLevels: Schema.optional(Schema.Record({ key: Schema.String, value: DebugLevelSchema })),
  defaultDurationMinutes: Schema.optional(Schema.Number),
  traceFlags: Schema.optional(Schema.Array(TraceFlagItemSchema))
}).pipe(Schema.annotations({ jsonSchema: { title: 'Trace Flags Configuration' } }));

export type TraceFlagsConfig = Schema.Schema.Type<typeof TraceFlagsConfigSchema>;
