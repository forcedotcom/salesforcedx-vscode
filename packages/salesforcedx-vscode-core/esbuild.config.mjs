/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { nodeConfig } from '../../scripts/bundling/node.mjs';
import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// Resolve templates from package node_modules first, then workspace root (for hoisted installs)
const packageTemplates = path.join(__dirname, 'node_modules', '@salesforce', 'templates', 'lib', 'templates');
const rootTemplates = path.join(__dirname, '..', '..', 'node_modules', '@salesforce', 'templates', 'lib', 'templates');
const srcTemplatesPath = fs.existsSync(packageTemplates) ? packageTemplates : rootTemplates;
const destTemplatesPath = path.join(__dirname, 'dist', 'templates');

await build({
  ...nodeConfig,
  entryPoints: ['./src/index.ts'],
  outdir: 'dist/src',
  external: [...nodeConfig.external, 'applicationinsights'],
  minify: true
});

if (fs.existsSync(srcTemplatesPath)) {
  copyFiles(srcTemplatesPath, destTemplatesPath);
} else {
  console.warn(`Templates path not found (tried ${packageTemplates} and ${rootTemplates}), skipping copy`);
}
