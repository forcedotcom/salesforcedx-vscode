/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const { build } = require('esbuild');
const esbuildPluginPino = require('esbuild-plugin-pino');
const fs = require('fs').promises;

const sharedConfig = {
  bundle: true,
  format: 'cjs',
  platform: 'node',
  loader: { '.node': 'file' },
  external: [
    'vscode',
    'applicationinsights',
    '@salesforce/lightning-lsp-common',
    '@salesforce/lwc-language-server',
    '@babel/preset-typescript/package.json',
    'jest-editor-support'
  ],
  minify: true,
  keepNames: true,
  plugins: [esbuildPluginPino({ transports: ['pino-pretty'] })],
  supported: {
    'dynamic-import': false
  },
  logOverride: {
    'unsupported-dynamic-import': 'error'
  }
};

// copy core-bundle/lib/transformStream.js to dist if core-bundle is included
const copyFiles = async (src, dest) => {
  try {
    // Copy the file
    await fs.copyFile(src, dest);
    console.log(`File was copied from ${src} to ${dest}`);
  } catch (error) {
    console.error('An error occurred:', error);
  }
};

const srcPath = '../../node_modules/@salesforce/core-bundle/lib/transformStream.js';
const destPath = './dist/transformStream.js';

(async () => {
  await build({
    ...sharedConfig,
    entryPoints: ['./src/index.ts'],
    outdir: 'dist'
  });
})()
  .then(async () => {
    await copyFiles(srcPath, destPath);
  })
  .catch(() => process.exit(1));
