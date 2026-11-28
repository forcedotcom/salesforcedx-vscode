/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable no-restricted-imports -- build script runs in Node only */
import * as JsonSchema from 'effect/JsonSchema';
import * as Schema from 'effect/Schema';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { buildTraceFlagsSchemas } from '../out/src/schemas/traceFlagsSchema.js';

const outPath = join(import.meta.dirname, '..', 'resources', 'traceFlags.schema.json');

await mkdir(dirname(outPath), { recursive: true });
const { TraceFlagsConfigSchema } = buildTraceFlagsSchemas();
const document = JsonSchema.toDocumentDraft07(Schema.toJsonSchemaDocument(TraceFlagsConfigSchema));
await writeFile(outPath, JSON.stringify(document, undefined, 2), 'utf-8');
