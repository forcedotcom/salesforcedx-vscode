/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { build } from 'esbuild';
import { writeFile } from 'fs/promises';
import { nodeConfig } from '../../scripts/bundling/node.mjs';

// Desktop extension bundle — consumes effect; ESM conditions now inherited from nodeConfig (ADR 0021)
const nodeBuild = await build({
  ...nodeConfig,
  mainFields: ['module', 'main'],
  entryPoints: ['./out/src/extension.js'],
  outfile: './dist/index.js',
  metafile: true
});

await writeFile('dist/node-metafile.json', JSON.stringify(nodeBuild.metafile, null, 2));

// the language server is a whole other package and we'll need to bundle that separately
// No effect in its graph; conditions now inherited from nodeConfig (W-19480954 LS bundling wanted ESM resolution). Keeps mainFields override.
await build({
  ...nodeConfig,
  mainFields: ['module', 'main'],
  entryPoints: ['../salesforcedx-visualforce-language-server/out/src/visualforceServer.js'],
  outfile: './dist/visualforceServer.js'
});
