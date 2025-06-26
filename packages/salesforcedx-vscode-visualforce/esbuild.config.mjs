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
  // the soql extension
  entryPoints: ['./out/src/index.js'],
  outfile: './dist/index.js'
});

// the language server is a monorepo sibling
await build({
  ...commonConfigNode,
  entryPoints: ['../salesforcedx-visualforce-language-server/out/src/visualforceServer.js'],
  outfile: './dist/visualforceServer.js',
  // Prefer ESM modules over UMD to avoid runtime require() issues
  mainFields: ['module', 'main'],
  format: 'cjs'
});
