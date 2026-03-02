/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable no-restricted-imports -- build script runs in Node only */
import * as JSONSchema from 'effect/JSONSchema';
import * as Schema from 'effect/Schema';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { buildTraceFlagsSchemas } from '../src/schemas/traceFlagsSchema';

/** Mirrors services TraceFlagItemStruct — only used for JSON schema generation at build time. */
const TraceFlagItemStruct = Schema.Struct({
  id: Schema.String,
  debugLevelId: Schema.optional(Schema.String),
  tracedEntityName: Schema.optional(Schema.String),
  tracedEntityId: Schema.optional(Schema.String),
  logType: Schema.Literal('USER_DEBUG', 'DEVELOPER_LOG', 'CLASS_TRACING'),
  startDate: Schema.optional(Schema.Date),
  expirationDate: Schema.Date,
  isActive: Schema.Boolean
});

const outPath = join(process.cwd(), 'resources/traceFlags.schema.json');

const main = async () => {
  await mkdir(dirname(outPath), { recursive: true });
  const { TraceFlagsConfigSchema } = buildTraceFlagsSchemas(TraceFlagItemStruct);
  const jsonSchema = JSONSchema.make(TraceFlagsConfigSchema);
  await writeFile(outPath, JSON.stringify(jsonSchema, undefined, 2), 'utf-8');
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
