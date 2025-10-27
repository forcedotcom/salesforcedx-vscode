/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { nodeConfig } from '../../scripts/bundling/node.mjs';
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';

await build({
  ...nodeConfig,
  external: ['vscode', 'applicationinsights', '@salesforce/lightning-lsp-common'],
  entryPoints: ['./src/index.ts'],
  outdir: 'dist'
});

// Bundle the Aura language server entry point
await build({
  ...nodeConfig,
  external: [
    'vscode',
    'applicationinsights',
    '@salesforce/lightning-lsp-common',
    'jsonc-parser',
    'vscode-html-languageservice'
  ],
  entryPoints: ['../salesforcedx-aura-language-server/src/server.ts'],
  outfile: './dist/auraLanguageServer.js',
  bundle: true,
  platform: 'node',
  target: 'node18',
  define: {
    ...nodeConfig.define
  },
  // Exclude test files from bundling
  ignoreAnnotations: true,
  plugins: [
    {
      name: 'exclude-tests',
      setup(build) {
        build.onResolve({ filter: /.*/ }, args => {
          // Exclude test files and __tests__ directories
          if (args.path.includes('__tests__') || args.path.includes('.test.') || args.path.includes('.spec.')) {
            return { path: args.path, external: true };
          }
        });
      }
    }
  ]
});

// Copy the resources directory from the aura language server to the dist folder
const resourcesSource = '../salesforcedx-aura-language-server/src/resources';
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
