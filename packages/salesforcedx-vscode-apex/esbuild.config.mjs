/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { build } from 'esbuild';
import copy from 'esbuild-plugin-copy';
import { nodeConfig } from '../../scripts/bundling/node.mjs';
import { writeFile } from 'fs/promises';

const nodeBuild = await build({
  ...nodeConfig,
  entryPoints: ['./out/src/index.js'],
  outdir: './dist',
  plugins: [
    ...(nodeConfig.plugins ?? []),
    copy({
      assets: {
        from: ['./out/apex-jorje-lsp.jar'],
        to: ['.']
      }
    })
  ],
  metafile: true
});

await writeFile('dist/node-metafile.json', JSON.stringify(nodeBuild.metafile, null, 2));
