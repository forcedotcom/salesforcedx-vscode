/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const { build } = require('esbuild');

const sharedConfig = {
  bundle: true,
  format: 'cjs',
  platform: 'node',
  external: ['vscode', 'applicationinsights', 'jsonpath'],
  minify: true,
  keepNames: true,
  supported: {
    'dynamic-import': false
  },
  logOverride: {
    'unsupported-dynamic-import': 'error'
  }
};

(async () => {
  await build({
    ...sharedConfig,
    entryPoints: ['./src/adapter/apexReplayDebug.ts'],
    outfile: 'dist/apexreplaydebug.js'
  });
})().catch(() => process.exit(1));
