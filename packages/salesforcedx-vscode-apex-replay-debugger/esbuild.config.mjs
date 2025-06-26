/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { build } from 'esbuild';
import { commonConfigNode } from '../../scripts/bundling/node.mjs';

// bundle the debugger
await build({
  ...commonConfigNode,
  entryPoints: ['../salesforcedx-apex-replay-debugger/out/src/adapter/apexReplayDebug.js'],
  outfile: './dist/apexReplayDebug.js'
});

// and the actual extension
await build({
  ...commonConfigNode,
  entryPoints: ['./out/src/index.js'],
  outdir: './dist'
});
