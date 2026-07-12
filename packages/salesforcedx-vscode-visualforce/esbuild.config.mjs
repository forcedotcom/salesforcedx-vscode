/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { build } from 'esbuild';
import { writeFile } from 'fs/promises';
import { nodeConfig } from '../../scripts/bundling/node.mjs';
import { effectEsmConditions } from '../../scripts/bundling/effect.mjs';
import { commonConfigBrowser } from '../../scripts/bundling/web.mjs';

// Desktop extension bundle — consumes effect, opts into shared ESM conditions
const nodeBuild = await build({
  ...nodeConfig,
  ...effectEsmConditions,
  mainFields: ['module', 'main'],
  entryPoints: ['./out/src/extension.js'],
  outfile: './dist/index.js',
  metafile: true
});

await writeFile('dist/node-metafile.json', JSON.stringify(nodeBuild.metafile, null, 2));

// the language server is a whole other package and we'll need to bundle that separately
// No effect in its graph; keeps its own literal conditions + mainFields (W-19480954 LS bundling).
// conditions value mirrors effectEsmConditions but intentionally stays literal — out of shared-effect scope (ADR 0021).
await build({
  ...nodeConfig,
  conditions: ['import', 'module', 'default'],
  mainFields: ['module', 'main'],
  entryPoints: ['../salesforcedx-visualforce-language-server/out/src/visualforceServer.js'],
  outfile: './dist/visualforceServer.js'
});

// Browser extension bundle (VS Code for the Web) — W-23358899 spike.
// outfile (not outdir) so the entry `extension.js` emits as `index.js`, matching the gated `browser` field.
const browserBuild = await build({
  ...commonConfigBrowser,
  external: ['vscode'],
  entryPoints: ['./out/src/extension.js'],
  outfile: './dist/web/index.js',
  metafile: true
});

await writeFile('dist/browser-metafile.json', JSON.stringify(browserBuild.metafile, null, 2));

// Browser language server (runs in a web worker) — IIFE so the worker global scope executes it directly.
// define ESBUILD_PLATFORM='web' so the browser connection branch is kept and javascriptMode + typescript are tree-shaken.
const serverBrowserBuild = await build({
  ...commonConfigBrowser,
  external: ['vscode'],
  entryPoints: ['../salesforcedx-visualforce-language-server/out/src/visualforceServer.js'],
  outfile: './dist/web/visualforceServer.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  mainFields: ['module', 'main'],
  define: { ...commonConfigBrowser.define, 'process.env.ESBUILD_PLATFORM': "'web'" },
  metafile: true
});

// Regression guard: the web LS bundle must NOT contain the node-only `typescript` package (it uses node fs).
// Phase 1's build-time dead-code elimination (languageModes.ts) is what keeps it out; if this fires, fix there.
const typescriptInWebServer = Object.keys(serverBrowserBuild.metafile.inputs).filter(p =>
  /node_modules\/typescript\//.test(p)
);
if (typescriptInWebServer.length > 0) {
  throw new Error(
    `web LS bundle unexpectedly includes 'typescript' (${typescriptInWebServer.length} inputs). ` +
      `Phase 1 dead-code elimination regressed — fix languageModes.ts, do not alias.`
  );
}
