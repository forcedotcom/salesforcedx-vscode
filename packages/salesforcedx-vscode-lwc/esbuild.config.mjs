/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { nodeConfig } from '../../scripts/bundling/node.mjs';
import { commonConfigBrowser } from '../../scripts/bundling/web.mjs';
import { build } from 'esbuild';
import { writeFile } from 'fs/promises';

// Node.js build (desktop VS Code)
const nodeBuild = await build({
  ...nodeConfig,
  loader: { '.node': 'file' },
  external: [...nodeConfig.external, 'jest-editor-support'],
  entryPoints: ['./src/index.ts'],
  outdir: 'dist',
  metafile: true
});

// Browser build (VS Code for the Web)
// Test support is lazy-loaded only when ESBUILD_PLATFORM !== 'web', so jest-editor-support and its Babel deps are tree-shaken; no need to external them
const browserBuild = await build({
  ...commonConfigBrowser,
  external: ['vscode'],
  entryPoints: ['./src/index.ts'],
  outdir: './dist/web',
  metafile: true
});

const htmlLsExternalList = ['vscode', 'applicationinsights', '@salesforce/lightning-lsp-common', 'jest-editor-support'];

// Bundle the LWC language server for Node.js (desktop VS Code)
// mainFields: ['module', 'main'] prefers the ESM build of vscode-html-languageservice (static imports).
// supported: { 'dynamic-import': true } overrides nodeConfig's false setting — the server runs in
// Node 18+ which natively supports import(), so @babel/core's import(filepath) config loader passes through.
await build({
  ...nodeConfig,
  loader: { '.node': 'file', '.json': 'json' },
  external: htmlLsExternalList,
  entryPoints: ['../salesforcedx-lwc-language-server/out/src/server.js'],
  outfile: './dist/lwcServer.js',
  bundle: true,
  platform: 'node',
  target: 'node18',
  define: { 'process.env.ESBUILD_PLATFORM': '"node"' },
  mainFields: ['module', 'main'],
  supported: { 'dynamic-import': true },
  logOverride: {
    ...nodeConfig.logOverride,
    'unsupported-dynamic-import': 'info'
  }
});

// Bundle the LWC language server for browser/web worker (VS Code for the Web)
// mainFields: ['module', 'main'] also ensures the ESM build is used for browser.
await build({
  ...commonConfigBrowser,
  loader: { '.json': 'json' },
  external: htmlLsExternalList,
  entryPoints: ['../salesforcedx-lwc-language-server/out/src/server.js'],
  outfile: './dist/web/lwcServer.js',
  bundle: true,
  platform: 'browser',
  format: 'iife', // IIFE format for web workers
  target: 'es2020',
  define: { ...commonConfigBrowser.define, 'process.env.ESBUILD_PLATFORM': '"web"' },
  mainFields: ['module', 'main']
});

// Write metafiles for dependency analysis
await writeFile('dist/node-metafile.json', JSON.stringify(nodeBuild.metafile, null, 2));
await writeFile('dist/browser-metafile.json', JSON.stringify(browserBuild.metafile, null, 2));
