/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..', '..');

// Disable minify when DEBUG_BUNDLE=1 (e.g. preLaunchTask "Compile and Bundle") so the debugger shows real variable names
const minify = process.env.DEBUG_BUNDLE !== '1';

await build({
  entryPoints: [join(repoRoot, 'packages/salesforcedx-apex-debugger/out/src/adapter/apexDebug.js')],
  external: ['vscode'],
  bundle: true,
  outfile: join(repoRoot, 'packages/salesforcedx-apex-debugger/dist/apexDebug.js'),
  format: 'cjs',
  platform: 'node',
  target: 'es2023',
  keepNames: true,
  minify,
  sourcemap: true,
  supported: {
    'dynamic-import': false
  },
  logOverride: {
    'unsupported-dynamic-import': 'error',
    'require-resolve-not-external': 'error'
  },
  define: {
    'process.env.SF_DISABLE_LOG_FILE': "'true'"
  }
});
