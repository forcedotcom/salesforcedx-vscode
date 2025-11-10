/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { nodeConfig } from '../../scripts/bundling/node.mjs';
import { build } from 'esbuild';
import { mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await build({
  ...nodeConfig,
  external: ['vscode'],
  entryPoints: ['./src/index.ts'],
  outdir: 'dist'
});

// Note: The Aura language server is NOT bundled - it uses the compiled version from
// ../salesforcedx-aura-language-server/out/src/server.js
// This avoids JSON import issues and matches how baseContext.ts works (external package)
// The serverPath in package.json should point to the compiled version

// Copy the resources directory from the local src to the dist folder
const resourcesSource = './src/resources';
const resourcesDest = './dist/resources';

if (existsSync(resourcesSource)) {
  // Create the resources directory in dist
  mkdirSync(resourcesDest, { recursive: true });

  // Copy the entire resources directory
  const { execSync } = await import('child_process');
  execSync(`cp -r ${resourcesSource}/* ${resourcesDest}/`, { stdio: 'inherit' });

  console.log('Copied resources directory to dist/');
} else {
  console.warn('Resources directory not found:', resourcesSource);
}
