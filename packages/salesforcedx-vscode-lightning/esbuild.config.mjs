/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { build } from 'esbuild';
import { commonConfigNode } from '../../scripts/bundling/node.mjs';

await build({
  ...commonConfigNode,
  entryPoints: ['../../node_modules/@salesforce/aura-language-server/lib/server.js'],
  outfile: './dist/server.js'
});

await build({
  ...commonConfigNode,
  entryPoints: ['./out/src/index.js'],
  outdir: './dist'
});
