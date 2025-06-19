/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { build } from 'esbuild';
import { commonConfigNode } from '../../scripts/bundling/node.mjs';

await build({
  ...commonConfigNode,
  entryPoints: ['./out/src/index.js'],
  external: [...commonConfigNode.external, '@babel/preset-typescript/package.json', 'jest-editor-support', 'jsonpath'],
  outdir: './dist'
});

await build({
  ...commonConfigNode,
  external: [...commonConfigNode.external, '@babel/core'],
  entryPoints: ['../../node_modules/@salesforce/lwc-language-server/lib/server.js'],
  outfile: './dist/server.js'
});
