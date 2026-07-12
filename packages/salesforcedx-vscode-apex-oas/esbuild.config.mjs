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
  external: ['vscode', 'applicationinsights', 'jsonpath', 'jsonc-parser'],
  keepNames: false,
  entryPoints: ['./src/index.ts'],
  outdir: 'dist',
  metafile: true
});

await writeFile('dist/node-metafile.json', JSON.stringify(nodeBuild.metafile, null, 2));
