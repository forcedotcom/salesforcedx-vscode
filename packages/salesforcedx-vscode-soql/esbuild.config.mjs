/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { build } from 'esbuild';
import copy from 'esbuild-plugin-copy';
import { createRequire } from 'node:module';
import { nodeConfig } from '../../scripts/bundling/node.mjs';
import { commonConfigBrowser } from '../../scripts/bundling/web.mjs';

const require = createRequire(import.meta.url);

const commonConfig = {
  external: ['vscode']
};

// Desktop extension bundle
await build({
  ...nodeConfig,
  ...commonConfig,
  entryPoints: ['./out/src/index.js'],
  outfile: './dist/index.js',
  plugins: [
    copy({
      assets: {
        from: [`./src/soql-builder-ui/dist/**`],
        to: ['./soql-builder-ui']
      }
    }),
    copy({
      assets: {
        from: ['./src/soql-data-view/**'],
        to: ['./soql-data-view']
      }
    })
  ]
});

// Desktop language server bundle
await build({
  ...nodeConfig,
  ...commonConfig,
  entryPoints: [require.resolve('@salesforce/soql-language-server/lib/server.js')],
  outfile: './dist/server.js'
});

// Web extension bundle
// Alias vscode-languageclient/node -> /browser so the LSP client works in a web worker context
await build({
  ...commonConfigBrowser,
  alias: {
    ...commonConfigBrowser.alias,
    'vscode-languageclient/node': 'vscode-languageclient/browser'
  },
  entryPoints: ['./out/src/index.js'],
  outfile: './dist/web/index.js'
});

// Web language server worker bundle
await build({
  ...commonConfigBrowser,
  format: 'iife', // Workers run as plain browser scripts — no module system, no `exports`
  entryPoints: [require.resolve('@salesforce/soql-language-server/lib/serverWorker.js')],
  outfile: './dist/serverWorker.js'
});
