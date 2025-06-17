/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { build } from 'esbuild';
import copy from 'esbuild-plugin-copy';

const commonConfig = {
  bundle: true,
  format: 'cjs',
  platform: 'node',
  external: ['vscode'],
  // TODO: we need a way to turn this off for debugging and local dev
  minify: true,
  keepNames: true,
  logOverride: {
    'unsupported-dynamic-import': 'error'
  }
};

// this is temporarily grabbing from the core-bundle but we'll elimintate that once everything bundles at real-time.
// as other packages move to the new bundling process, this probably needs to move to a shared location
const pinoSupport = [
  copy({
    assets: {
      from: ['../../node_modules/@salesforce/core-bundle/lib/transformStream.js'],
      to: ['./transformStream.js']
    }
  }),
  copy({
    assets: {
      from: ['../../node_modules/@salesforce/core-bundle/lib/thread-stream-worker.js'],
      to: ['./thread-stream-worker.js']
    }
  }),
  copy({
    assets: {
      from: ['../../node_modules/@salesforce/core-bundle/lib/pino-pretty.js'],
      to: ['./pino-pretty.js']
    }
  }),
  copy({
    assets: {
      from: ['../../node_modules/@salesforce/core-bundle/lib/pino-worker.js'],
      to: ['./pino-worker.js']
    }
  }),
  copy({
    assets: {
      from: ['../../node_modules/@salesforce/core-bundle/lib/pino-file.js'],
      to: ['./pino-file.js']
    }
  })
];

await build({
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
    }),
    ...pinoSupport
  ]
});

// the language server is a whole other package and we'll need to bundle that separately
await build({
  ...commonConfig,
  entryPoints: ['../../node_modules/@salesforce/soql-language-server/lib/server.js'],
  outfile: './dist/server.js'
});
