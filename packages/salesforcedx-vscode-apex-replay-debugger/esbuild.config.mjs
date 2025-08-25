/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { nodeConfig } from '../../scripts/bundling/node.mjs';
import { build } from 'esbuild';

await build({
  ...nodeConfig,
  external: ['vscode', 'applicationinsights', 'jsonpath'],
  entryPoints: ['./src/index.ts'],
  outdir: 'dist'
});
