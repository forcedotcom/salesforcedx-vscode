/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { build } from 'esbuild';
import { commonConfigNode } from '../../scripts/bundling/node.mjs';
import { commonConfigBrowser } from '../../scripts/bundling/web.mjs';
import { writeFile } from 'fs/promises';

// Desktop build (Node.js environment)
const nodeBuild = await build({
  ...commonConfigNode,
  entryPoints: ['./out/src/index.js'],
  outdir: './dist',
  metafile: true
});

// Browser build (browser environment)
const browserBuild = await build({
  ...commonConfigBrowser,
  entryPoints: ['./out/src/index.js'],
  outfile: './dist/browser.js',
  metafile: true
});

await writeFile('dist/node-metafile.json', JSON.stringify(nodeBuild.metafile, null, 2));
await writeFile('dist/browser-metafile.json', JSON.stringify(browserBuild.metafile, null, 2));
