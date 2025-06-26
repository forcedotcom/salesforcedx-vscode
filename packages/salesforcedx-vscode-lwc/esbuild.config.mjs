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
  entryPoints: ['./out/src/index.js'],
  external: [
    ...commonConfigNode.external,
    '@babel/preset-typescript/package.json',
    'jest-editor-support',
    'jsonpath',
    'jsonc-parser',
    'vscode-html-languageservice'
  ],
  outdir: './dist'
});

await build({
  ...commonConfigNode,
  external: [
    ...commonConfigNode.external,
    '@babel/core',
    'vscode-html-languageservice',
    'jsonc-parser',
    '@salesforce/lightning-lsp-common/node_modules/jsonc-parser'
  ],
  plugins: [
    ...(commonConfigNode.plugins ?? []),
    copy({
      assets: [
        {
          from: ['../../node_modules/@salesforce/lwc-language-server/lib/resources/**'],
          to: ['./resources']
        },
        {
          from: ['../../node_modules/@salesforce/lightning-lsp-common/lib/resources/**'],
          to: ['./resources']
        }
      ]
    })
  ],
  entryPoints: ['../../node_modules/@salesforce/lwc-language-server/lib/server.js'],
  outfile: './dist/server.js'
});
