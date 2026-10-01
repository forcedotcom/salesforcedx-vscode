/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { build } from 'esbuild';
import { writeFile } from 'fs/promises';
import { nodeConfig } from '../../scripts/bundling/node.mjs';

const nodeBuild = await build({
  ...nodeConfig,
  entryPoints: ['./out/src/index.js'],
  outdir: './dist',
  metafile: true
});

await writeFile('dist/node-metafile.json', JSON.stringify(nodeBuild.metafile, null, 2));

await build({
  bundle: true,
  format: 'esm',
  platform: 'browser',
  entryPoints: ['./src/soql-data-view/queryResultRenderer.js'],
  outfile: './dist/soql-data-view/queryResultRenderer.js',
  loader: {
    '.css': 'text'
  }
});
