/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable no-restricted-imports -- build script runs in Node only */
import * as JSONSchema from 'effect/JSONSchema';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { TraceFlagsConfigSchema } from '../src/schemas/traceFlagsSchema';

const outPath = join(process.cwd(), 'resources/traceFlags.schema.json');

const main = async () => {
  await mkdir(dirname(outPath), { recursive: true });
  const jsonSchema = JSONSchema.make(TraceFlagsConfigSchema);
  await writeFile(outPath, JSON.stringify(jsonSchema, undefined, 2), 'utf-8');
};

main().catch(err => {
  console.error(err);
  process.exit(1);
});
