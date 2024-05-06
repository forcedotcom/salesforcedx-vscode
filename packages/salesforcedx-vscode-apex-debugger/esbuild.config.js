/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const { build } = require('esbuild');
// const fs = require('fs').promises;

// Configure and run the build process
const sharedConfig = {
  bundle: true,                     // Bundle all dependencies into one file
  format: 'cjs',                    // Output format (CommonJS)
  platform: 'node',                 // Platform target (Node.js)
  minify: true,                     // Minify the output
  external: [
    'vscode',
    '@salesforce/core-bundle',
    '@salesforce/source-tracking-bundle'
  ]
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