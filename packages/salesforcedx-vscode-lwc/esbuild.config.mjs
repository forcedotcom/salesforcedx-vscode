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
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Node.js build (desktop VS Code)
const nodeBuild = await build({
  ...nodeConfig,
  loader: { '.node': 'file' },
  external: [
    ...nodeConfig.external,
    'applicationinsights',
    '@babel/preset-typescript/package.json',
    'jest-editor-support',
    '@babel/core'
  ],
  entryPoints: ['./src/index.ts'],
  outdir: 'dist',
  metafile: true
});

// Browser build (VS Code for the Web)
const browserBuild = await build({
  ...commonConfigBrowser,
  external: [
    'vscode',
    'applicationinsights',
    '@babel/preset-typescript/package.json',
    'jest-editor-support',
    '@babel/core'
  ],
  entryPoints: ['./src/index.ts'],
  outdir: './dist/web',
  metafile: true
});

// Bundle the LWC language server for Node.js (desktop VS Code)
// This matches the pattern used by Visualforce and SOQL extensions
// Note: vscode-html-languageservice must be external because it uses dynamic requires
// that esbuild cannot resolve (e.g., './parser/htmlScanner')
await build({
  ...nodeConfig,
  loader: { '.node': 'file', '.json': 'json' },
  external: [
    'vscode',
    'applicationinsights',
    '@salesforce/lightning-lsp-common',
    '@babel/preset-typescript/package.json',
    'jest-editor-support',
    '@babel/core',
    'vscode-html-languageservice'
  ],
  entryPoints: ['../salesforcedx-lwc-language-server/out/src/server.js'],
  outfile: './dist/lwcServer.js',
  bundle: true,
  platform: 'node',
  target: 'node18'
});

// Bundle the LWC language server for browser/web worker (VS Code for the Web)
// The language server runs in a web worker, so we need a browser-compatible bundle
// Note: vscode-html-languageservice must be bundled (not external) for browser to avoid dynamic require errors
// We configure esbuild to prefer the ESM version which doesn't use dynamic requires
await build({
  ...commonConfigBrowser,
  loader: { '.json': 'json' },
  external: [
    'vscode',
    'applicationinsights',
    '@salesforce/lightning-lsp-common',
    '@babel/preset-typescript/package.json',
    'jest-editor-support'
    // @babel/core is NOT external - it needs to be bundled for browser to avoid dynamic require errors
    // tty is NOT external - it needs to be aliased to empty polyfill (handled via alias in commonConfigBrowser)
    // vscode-html-languageservice is NOT external - it needs to be bundled for browser
  ],
  entryPoints: ['../salesforcedx-lwc-language-server/src/serverBrowser.ts'],
  outfile: './dist/web/lwcServer.js',
  bundle: true,
  platform: 'browser',
  format: 'iife', // IIFE format for web workers
  target: 'es2020',
  // Prefer ESM version to avoid dynamic requires in UMD version
  mainFields: ['module', 'main'],
  plugins: [
    {
      name: 'resolve-vscode-html-languageservice-dynamic-requires',
      setup(build) {
        // Resolve dynamic requires within vscode-html-languageservice UMD build
        // Map relative requires to their actual file paths using ESM version
        build.onResolve({ filter: /^\.\.\/parser\/htmlScanner$/ }, args => {
          if (args.importer.includes('vscode-html-languageservice')) {
            // Resolve to ESM version to avoid dynamic requires
            const htmlScannerPath = resolve(
              __dirname,
              '../../node_modules/vscode-html-languageservice/lib/esm/parser/htmlScanner.js'
            );
            return { path: htmlScannerPath };
          }
        });
        build.onResolve({ filter: /^\.\/parser\/htmlScanner$/ }, args => {
          if (args.importer.includes('vscode-html-languageservice')) {
            const htmlScannerPath = resolve(
              __dirname,
              '../../node_modules/vscode-html-languageservice/lib/esm/parser/htmlScanner.js'
            );
            return { path: htmlScannerPath };
          }
        });
      }
    }
  ]
});

// Write metafiles for dependency analysis
await writeFile('dist/node-metafile.json', JSON.stringify(nodeBuild.metafile, null, 2));
await writeFile('dist/browser-metafile.json', JSON.stringify(browserBuild.metafile, null, 2));
