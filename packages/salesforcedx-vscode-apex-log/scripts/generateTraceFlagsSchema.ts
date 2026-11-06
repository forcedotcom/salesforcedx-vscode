/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable no-restricted-imports -- build script runs in Node only */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const outPath = join(process.cwd(), 'resources/traceFlags.schema.json');

const main = async () => {
  const [jsonSchema, schema, { buildTraceFlagsSchemas }] = await Promise.all([
    import('effect/JsonSchema'),
    import('effect/Schema'),
    import('../out/src/schemas/traceFlagsSchema.js')
  ]);
  await mkdir(dirname(outPath), { recursive: true });
  const { TraceFlagsConfigSchema } = buildTraceFlagsSchemas();
  const document = jsonSchema.toDocumentDraft07(schema.toJsonSchemaDocument(TraceFlagsConfigSchema));
  await writeFile(outPath, JSON.stringify(document, undefined, 2), 'utf-8');
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
