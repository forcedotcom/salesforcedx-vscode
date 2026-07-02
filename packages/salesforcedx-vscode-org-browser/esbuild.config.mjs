/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { build } from 'esbuild';
import { nodeConfig } from '../../scripts/bundling/node.mjs';
import { commonConfigBrowser } from '../../scripts/bundling/web.mjs';
import { writeFile } from 'fs/promises';

// local override: force esbuild to resolve effect's ESM build so unused
// submodules (e.g. fast-check via Schema) tree-shake out. output stays CJS.
const nodeBuild = await build({
  ...nodeConfig,
  conditions: ['import'],
  entryPoints: ['./out/src/index.js'],
  outdir: './dist',
  plugins: [...(nodeConfig.plugins ?? [])],
  metafile: true
});

// Browser build (browser environment)
const browserBuild = await build({
  ...commonConfigBrowser,
  conditions: ['import'],
  external: ['vscode'],
  entryPoints: ['./out/src/index.js'],
  outdir: './dist/web',
  metafile: true
});

await writeFile('dist/node-metafile.json', JSON.stringify(nodeBuild.metafile, null, 2));
await writeFile('dist/browser-metafile.json', JSON.stringify(browserBuild.metafile, null, 2));
