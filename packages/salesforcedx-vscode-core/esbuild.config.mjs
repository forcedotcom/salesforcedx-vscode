/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { build } from 'esbuild';
import { bundleTransformStream, pinoSupport } from '../../scripts/bundling/pinoSupport.mjs';
import { commonConfigNode } from '../../scripts/bundling/node.mjs';

await build({
  ...commonConfigNode,
  // the soql extension
  entryPoints: ['./out/src/index.js'],
  outdir: './dist',
  plugins: [...pinoSupport]
});

await bundleTransformStream();
