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
  external: [...nodeConfig.external, 'applicationinsights', 'jsonpath', 'jsonc-parser'],
  keepNames: false, // set it false to get rid of error: __name is undefined. https://github.com/evanw/esbuild/issues/3455
  entryPoints: ['./src/index.ts'],
  outdir: 'dist'
});
