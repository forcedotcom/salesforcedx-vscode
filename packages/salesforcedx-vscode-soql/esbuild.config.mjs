/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { build } from 'esbuild';
import { commonConfigNode } from '../../scripts/bundling/node.mjs';
import { copy } from 'esbuild-plugin-copy';

await build({
  ...commonConfigNode,
  // the soql extension
  entryPoints: ['./out/src/index.js'],
  outdir: './dist',
  plugins: [
    copy({
      assets: [
        {
          from: [`../../node_modules/@salesforce/soql-builder-ui/dist/**`],
          to: ['./soql-builder-ui']
        },
        {
          from: ['../../node_modules/@salesforce/soql-data-view/web/**'],
          to: ['./soql-data-view']
        },
        {
          from: ['../../node_modules/@salesforce/apex-tmlanguage/grammars'],
          to: ['./grammars']
        }
      ]
    })
  ]
});

// the language server is a whole other package and we'll need to bundle that separately
await build({
  ...commonConfigNode,
  entryPoints: ['../../node_modules/@salesforce/soql-language-server/lib/server.js'],
  outfile: './dist/server.js'
});
