/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { nodeConfig } from '../../scripts/bundling/node.mjs';
import { build } from 'esbuild';
import { mkdirSync, existsSync } from 'fs';

await build({
  ...nodeConfig,
  external: ['vscode'],
  entryPoints: ['./src/index.ts'],
  outdir: 'dist'
});

// Bundle the Aura language server to ensure consistency between dev and packaged versions
// This matches the pattern used by LWC, Visualforce and SOQL extensions
// Note: vscode-html-languageservice must be external because it uses dynamic requires
// that esbuild cannot resolve (e.g., './parser/htmlScanner')
// Note: tern/lib files must be external because they use a plugin system that breaks when bundled
await build({
  ...nodeConfig,
  loader: { '.node': 'file', '.json': 'json' },
  external: ['vscode', 'applicationinsights', '@salesforce/lightning-lsp-common', 'vscode-html-languageservice'],
  entryPoints: ['../salesforcedx-aura-language-server/out/src/server.js'],
  outfile: './dist/auraServer.js',
  bundle: true,
  platform: 'node',
  target: 'node18',
  plugins: [
    {
      name: 'external-tern',
      setup(build) {
        // Mark tern/lib imports as external
        build.onResolve({ filter: /^\.\.\/tern\/lib\// }, () => ({ external: true }));
      }
    }
  ]
});

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

// Copy the tern/defs directory from the compiled Aura language server
// The bundled server needs these JSON files at runtime (browser.json, ecmascript.json, etc.)
// When bundled, __dirname is 'dist/', so '../tern/defs' resolves to 'tern/defs/' at extension root
const ternDefsSource = '../salesforcedx-aura-language-server/out/src/tern/defs';
const ternDefsDest = './tern/defs';

if (existsSync(ternDefsSource)) {
  // Create the tern/defs directory at extension root
  mkdirSync(ternDefsDest, { recursive: true });

  // Copy the entire tern/defs directory
  const { execSync } = await import('child_process');
  execSync(`cp -r ${ternDefsSource}/* ${ternDefsDest}/`, { stdio: 'inherit' });

  console.log('Copied tern/defs directory to tern/defs/');
} else {
  console.warn('tern/defs directory not found:', ternDefsSource);
  console.warn('Make sure the Aura language server has been compiled (npm run compile)');
}

// Copy the tern/lib directory from the compiled Aura language server
// The bundled server needs these files at runtime but they're marked as external
// When bundled, __dirname is 'dist/', so '../tern/lib' resolves to 'tern/lib/' at extension root
const ternLibSource = '../salesforcedx-aura-language-server/out/src/tern/lib';
const ternLibDest = './tern/lib';

if (existsSync(ternLibSource)) {
  // Create the tern/lib directory at extension root
  mkdirSync(ternLibDest, { recursive: true });

  // Copy the entire tern/lib directory
  const { execSync } = await import('child_process');
  execSync(`cp -r ${ternLibSource}/* ${ternLibDest}/`, { stdio: 'inherit' });

  console.log('Copied tern/lib directory to tern/lib/');
} else {
  console.warn('tern/lib directory not found:', ternLibSource);
  console.warn('Make sure the Aura language server has been compiled (npm run compile)');
}

// Copy the tern/plugin directory from the compiled Aura language server
// The bundled server needs the 'modules' plugin to initialize server.mod.modules
// When bundled, __dirname is 'dist/', so '../tern/plugin' resolves to 'tern/plugin/' at extension root
const ternPluginSource = '../salesforcedx-aura-language-server/out/src/tern/plugin';
const ternPluginDest = './tern/plugin';

if (existsSync(ternPluginSource)) {
  // Create the tern/plugin directory at extension root
  mkdirSync(ternPluginDest, { recursive: true });

  // Copy the entire tern/plugin directory
  const { execSync } = await import('child_process');
  execSync(`cp -r ${ternPluginSource}/* ${ternPluginDest}/`, { stdio: 'inherit' });

  console.log('Copied tern/plugin directory to tern/plugin/');
} else {
  console.warn('tern/plugin directory not found:', ternPluginSource);
  console.warn('Make sure the Aura language server has been compiled (npm run compile)');
}
