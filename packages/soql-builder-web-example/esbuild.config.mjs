/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { copyFile, mkdir } from 'node:fs/promises';
import { build } from 'esbuild';

await mkdir('dist', { recursive: true });
await Promise.all([
  copyFile('src/index.html', 'dist/index.html'),
  copyFile('src/styles.css', 'dist/styles.css'),
  build({
    bundle: true,
    entryPoints: ['src/client.ts'],
    format: 'esm',
    outfile: 'dist/app.js',
    platform: 'browser',
    sourcemap: true,
    target: 'es2022'
  })
]);
