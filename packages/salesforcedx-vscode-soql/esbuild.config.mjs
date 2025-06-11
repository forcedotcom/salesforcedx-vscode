/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { build } from 'esbuild';

await build({
  bundle: true,
  format: 'cjs',
  platform: 'node',
  external: ['vscode', 'applicationinsights'],
  minify: true,
  keepNames: true,
  logOverride: {
    'unsupported-dynamic-import': 'error'
  },
  entryPoints: ['./out/src/index.js'],
  outdir: 'dist'
});
