/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { commonConfigBrowser } from '../../../../scripts/bundling/web.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const outputDirectory = path.join(directory, 'dist-lit');

await mkdir(outputDirectory, { recursive: true });
await build({
  ...commonConfigBrowser,
  entryPoints: [path.join(directory, 'lit', 'index.ts')],
  format: 'iife',
  outfile: path.join(outputDirectory, 'app.js'),
  sourcemap: false
});
await copyFile(path.join(directory, 'lit', 'index.html'), path.join(outputDirectory, 'index.html'));
