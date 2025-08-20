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
  ...sharedConfig,
  loader: { '.node': 'file' },
  external: [
    'vscode',
    'applicationinsights',
    '@salesforce/lightning-lsp-common',
    '@salesforce/lwc-language-server',
    '@babel/preset-typescript/package.json',
    'jest-editor-support'
  ],
  entryPoints: ['./src/index.ts'],
  outdir: 'dist'
});
