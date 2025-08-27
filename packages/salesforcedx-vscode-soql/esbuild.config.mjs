/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { build } from 'esbuild';
import copy from 'esbuild-plugin-copy';
import { nodeConfig } from '../../scripts/bundling/node.mjs';

const commonConfig = {
  external: ['vscode']
};

await build({
  ...nodeConfig,
  ...commonConfig,
  // the soql extension
  entryPoints: ['./out/src/index.js'],
  outfile: './dist/index.js',
  plugins: [
    copy({
      assets: {
        from: [`../../node_modules/@salesforce/soql-builder-ui/dist/**`],
        to: ['./soql-builder-ui']
      }
    }),
    copy({
      assets: {
        from: ['../../node_modules/@salesforce/soql-data-view/web/**'],
        to: ['./soql-data-view']
      }
    })
  ]
});

// the language server is a whole other package and we'll need to bundle that separately
await build({
  ...nodeConfig,
  ...commonConfig,
  entryPoints: ['../../node_modules/@salesforce/soql-language-server/lib/server.js'],
  outfile: './dist/server.js'
});
