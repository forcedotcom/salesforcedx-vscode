/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { build } from 'esbuild';
import { nodeConfig } from '../../scripts/bundling/node.mjs';

const commonConfig = {
  external: ['vscode'],
  conditions: ['import', 'module', 'default'],
  mainFields: ['module', 'main']
};

await build({
  ...nodeConfig,
  ...commonConfig,
  entryPoints: ['./out/src/extension.js'],
  outfile: './dist/index.js'
});

// the language server is a whole other package and we'll need to bundle that separately
await build({
  ...nodeConfig,
  ...commonConfig,
  entryPoints: ['../salesforcedx-visualforce-language-server/out/src/visualforceServer.js'],
  outfile: './dist/visualforceServer.js'
});
