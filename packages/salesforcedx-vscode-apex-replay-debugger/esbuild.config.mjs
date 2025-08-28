/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { nodeConfig } from '../../scripts/bundling/node.mjs';
import { build } from 'esbuild';

await build({
  ...nodeConfig,
  external: ['vscode', 'esprima', '../include/module.js', '../include/action.js'],
  entryPoints: ['./src/index.ts', '../salesforcedx-apex-replay-debugger/out/src/adapter/apexReplayDebug.js'],
  outdir: 'dist'
});
