/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const { build } = require('esbuild');
const esbuildPluginPino = require('esbuild-plugin-pino');
const fs = require('fs');

const sharedConfig = {
  bundle: true,
  format: 'cjs',
  platform: 'node',
  external: ['vscode', 'applicationinsights', 'shelljs', '@salesforce/schemas'],
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

const copyFiles = (src, dest) => {
  const stats = fs.statSync(src);
  try {
    if (stats.isDirectory()) {
      fs.cpSync(src, dest, { recursive: true });
    } else {
      fs.cpSync(src, dest);
    }
    console.log(`Copied from ${src} to ${dest}`);
  } catch (error) {
    console.error('An error occurred:', error);
  }
};

// copy core-bundle/lib/transformStream.js to dist if core-bundle is included
const srcPathTransformStream = '../../node_modules/@salesforce/core-bundle/lib/transformStream.js';
const destPathTransformStream = './dist/src/transformStream.js';

const srcTemplatesPath = '../../node_modules/@salesforce/templates/lib/templates';
const destTemplatesPath = './dist/templates';

(async () => {
  await build({
    ...sharedConfig,
    entryPoints: ['./src/index.ts'],
    outdir: 'dist/src'
  });
})()
  .then(() => {
    copyFiles(srcPathTransformStream, destPathTransformStream);
    copyFiles(srcTemplatesPath, destTemplatesPath);
  })
  .catch(() => process.exit(1));
