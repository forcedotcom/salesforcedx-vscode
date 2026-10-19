/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { nodeConfig } from '../../scripts/bundling/node.mjs';
import { build } from 'esbuild';
import { writeFile } from 'fs/promises';

const nodeBuild = await build({
  ...nodeConfig,
  // jsonc-parser's UMD entry hides require calls from esbuild; bundle its ESM entry instead.
  mainFields: ['module', 'main'],
  keepNames: false,
  entryPoints: ['./out/src/index.js'],
  outdir: 'dist',
  metafile: true
});

await writeFile('dist/node-metafile.json', JSON.stringify(nodeBuild.metafile, null, 2));
