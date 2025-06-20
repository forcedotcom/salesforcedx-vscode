/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { build } from 'esbuild';
import { commonConfigNode } from '../../scripts/bundling/node.mjs';
import copy from 'esbuild-plugin-copy';

await build({
  ...commonConfigNode,
  entryPoints: ['../../node_modules/@salesforce/aura-language-server/lib/server.js'],
  external: [...(commonConfigNode.external ?? []), '@salesforce/lightning-lsp-common'],
  outfile: './dist/server.js'
});

await build({
  ...commonConfigNode,
  entryPoints: ['./out/src/index.js'],
  external: [...(commonConfigNode.external ?? []), '@salesforce/lightning-lsp-common'],
  outdir: './dist',
  plugins: [
    ...(commonConfigNode.plugins ?? []),
    copy({
      // used by the server, but can be copies into dist from either
      assets: [
        {
          from: ['../../node_modules/@salesforce/aura-language-server/resources/**'],
          to: ['./resources']
        },
        {
          from: ['../../node_modules/@salesforce/aura-language-server/lib/resources/**'],
          to: ['./resources']
        }
      ]
    })
  ]
});
