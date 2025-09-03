/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { nodeConfig } from '../../scripts/bundling/node.mjs';
import { build } from 'esbuild';
import fs from 'fs';

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

const srcTemplatesPath = '../../node_modules/@salesforce/templates/lib/templates';
const destTemplatesPath = './dist/templates';

await build({
  ...nodeConfig,
  entryPoints: ['./src/index.ts'],
  outdir: 'dist/src',
  external: [...nodeConfig.external, 'applicationinsights', '@salesforce/schemas'],
  minify: true
});

copyFiles(srcTemplatesPath, destTemplatesPath);
