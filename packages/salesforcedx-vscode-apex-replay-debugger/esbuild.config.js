/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const { build } = require('esbuild');
// const fs = require('fs').promises;

const sharedConfig = {
  bundle: true,
  format: 'cjs',
  platform: 'node',
  external: [
    'vscode',
    '@salesforce/core',
    '@salesforce/source-tracking',
    'applicationinsights'
  ],
  minify: true
};

// copy core-bundle/lib/transformStream.js to dist if core-bundle is included
// const copyFiles = async (src, dest) => {
//   try {
//     // Copy the file
//     await fs.copyFile(src, dest);
//     console.log(`File was copied from ${src} to ${dest}`);
//   } catch (error) {
//     console.error('An error occurred:', error);
//   }
// };

// const srcPath = '../../node_modules/@salesforce/core-bundle/lib/transformStream.js';
// const destPath = './dist/transformStream.js';

(async () => {
  await build({
    ...sharedConfig,
    entryPoints: ['./src/index.ts'],
    outfile: 'dist/index.js'
  });
})().then(async () => {
  // await copyFiles(srcPath, destPath);
}).catch(() => process.exit(1));