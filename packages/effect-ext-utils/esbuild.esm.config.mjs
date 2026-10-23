/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { build } from 'esbuild';
import { nodeConfig } from '../../scripts/bundling/node.mjs';
import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile('./package.json', 'utf8'));

await build({
  ...nodeConfig,
  // Keep dependencies as ESM imports so consumer bundles can deduplicate them with direct imports.
  external: ['vscode', ...Object.keys(packageJson.dependencies ?? {})],
  format: 'esm',
  outExtension: { '.js': '.mjs' },
  supported: { ...nodeConfig.supported, 'dynamic-import': true },
  sourcemap: false,
  entryPoints: ['./dist/ts-esm/src/index.js'],
  outdir: './dist/esm'
});
