/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { nodeConfig, nodeEsmConfig } from '../../scripts/bundling/node.mjs';
import { build } from 'esbuild';

await build({
  ...nodeEsmConfig,
  external: ['vscode'],
  entryPoints: ['./out/src/index.js'],
  outdir: 'dist'
});

await build({
  ...nodeConfig,
  external: ['vscode'],
  entryPoints: ['../salesforcedx-apex-replay-debugger/out/src/adapter/apexReplayDebug.js'],
  // do this as file to keep it from adding relative paths
  outfile: 'dist/apexReplayDebug.js'
});
