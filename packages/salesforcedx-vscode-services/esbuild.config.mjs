/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { build } from 'esbuild';
import { commonConfigNode } from '../../scripts/bundling/node.mjs';
import { commonConfigBrowser } from '../../scripts/bundling/web.mjs';

// Desktop build (Node.js environment)
await build({
  ...commonConfigNode,
  entryPoints: ['./out/src/index.js'],
  outdir: './dist',
  plugins: [...(commonConfigNode.plugins ?? [])]
});

// Browser build (browser environment)
await build({
  ...commonConfigBrowser,
  external: ['vscode'],
  entryPoints: ['./out/src/index.js'],
  outfile: './dist/browser.js',
  mainFields: ['browser', 'module', 'main']
});
