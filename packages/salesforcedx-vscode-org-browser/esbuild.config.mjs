/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { build } from 'esbuild';
import { nodeConfig } from '../../scripts/bundling/node.mjs';
import { commonConfigBrowser } from '../../scripts/bundling/web.mjs';

await build({
  ...nodeConfig,
  entryPoints: ['./out/src/index.js'],
  outdir: './dist',
  plugins: [...(nodeConfig.plugins ?? [])]
});

// Browser build (browser environment)
await build({
  ...commonConfigBrowser,
  external: ['vscode'],
  entryPoints: ['./out/src/index.js'],
  outfile: './dist/browser.js'
});
