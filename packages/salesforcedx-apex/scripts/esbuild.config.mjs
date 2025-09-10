/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { build } from 'esbuild';

await build({
  bundle: true,
  format: 'cjs',
  platform: 'node',
  external: [], // The whitelist of dependencies that are not bundle-able
  keepNames: true,
  plugins: [],
  supported: {
    'dynamic-import': false
  },
  logOverride: {
    'unsupported-dynamic-import': 'error'
  },
  entryPoints: ['./lib/src/index.js'],
  outdir: 'dist'
});
