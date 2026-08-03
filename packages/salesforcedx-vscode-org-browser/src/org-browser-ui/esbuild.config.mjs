/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { build } from 'esbuild';
import { rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
await rm(join(root, 'dist'), { recursive: true, force: true });
await build({
  absWorkingDir: root,
  entryPoints: ['index.tsx'],
  bundle: true,
  outfile: 'dist/app.js',
  platform: 'browser',
  format: 'iife',
  target: ['es2022'],
  sourcemap: true,
  minify: true,
  legalComments: 'none'
});
