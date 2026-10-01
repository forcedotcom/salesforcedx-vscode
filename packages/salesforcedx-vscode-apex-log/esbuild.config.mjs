/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { build } from 'esbuild';
import { nodeConfig } from '../../scripts/bundling/node.mjs';
import { commonConfigBrowser } from '../../scripts/bundling/web.mjs';
import { writeFile } from 'fs/promises';
import fs from 'node:fs';

// vsce's secret scanner uses the pattern /SG\.\w{1,128}\.\w{1,128}/ to detect
// Sendgrid API keys. When esbuild minifies and assigns the variable wrapping
// effect/internal/redacted.js the name `SG`, `SG.redactedRegistry.set(...)` in
// effect/internal/secret.js matches the pattern. Rename the `redactedRegistry`
// export in both files so the property never appears in minified output.
const effectSecretScannerWorkaroundPlugin = () => ({
  name: 'effect-secret-scanner-workaround',
  setup(build) {
    build.onLoad({ filter: /effect.*internal.*(redacted|secret)\.js$/ }, async args => {
      const contents = await fs.promises.readFile(args.path, 'utf8');
      return { contents: contents.replaceAll('.redactedRegistry', '.$rReg'), loader: 'js' };
    });
  }
});

const nodeBuild = await build({
  ...nodeConfig,
  entryPoints: ['./out/src/index.js'],
  outdir: './dist',
  plugins: [...(nodeConfig.plugins ?? [])],
  metafile: true
});

const browserBuild = await build({
  ...commonConfigBrowser,
  external: ['vscode'],
  entryPoints: ['./out/src/index.js'],
  outdir: './dist/web',
  metafile: true,
  plugins: [...(commonConfigBrowser.plugins ?? []), effectSecretScannerWorkaroundPlugin()]
});

await writeFile('dist/node-metafile.json', JSON.stringify(nodeBuild.metafile, null, 2));
await writeFile('dist/browser-metafile.json', JSON.stringify(browserBuild.metafile, null, 2));
