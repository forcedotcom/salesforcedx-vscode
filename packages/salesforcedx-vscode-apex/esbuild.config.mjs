/*
 * Copyright (c) 2024, salesforce.com, inc.
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
  outdir: './dist',
  external: [...(commonConfigNode.external ?? []), 'jsonpath', 'jsonc-parser'],
  plugins: [
    ...(commonConfigNode.plugins ?? []),
    copy({
      assets: [
        {
          from: ['./jars/apex-jorje-lsp.jar'],
          to: ['./apex-jorje-lsp.jar']
        },
        {
          from: ['../../node_modules/@salesforce/apex-tmlanguage/grammars'],
          to: ['./grammars']
        }
      ]
    })
  ]
});
