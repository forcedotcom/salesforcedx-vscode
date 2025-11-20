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
  loader: { '.node': 'file' },
  external: [
    ...nodeConfig.external,
    'applicationinsights',
    '@babel/preset-typescript/package.json',
    'jest-editor-support',
    '@babel/core'
  ],
  entryPoints: ['./src/index.ts'],
  outdir: 'dist'
});

// Bundle the external LWC language server package
await build({
  ...nodeConfig,
  loader: { '.node': 'file' },
  external: [
    'vscode',
    'applicationinsights',
    '@salesforce/lightning-lsp-common',
    '@babel/preset-typescript/package.json',
    'jest-editor-support',
    '@babel/core'
  ],
  entryPoints: ['../salesforcedx-lwc-language-server/out/src/lwcServer.js'],
  outfile: './dist/lwcServer.js',
  bundle: true,
  platform: 'node',
  target: 'node18'
});
