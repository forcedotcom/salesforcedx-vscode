/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Anti-regression guard: fail a web (browser) bundle that externalizes any node builtin
// outside the documented benign allowlist. A future apex src edit that adds a bare
// require('child_process'), an un-aliased builtin, etc. would surface here as a throw
// instead of silently shipping node-only code into the web extension host bundle.

import { readFile } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';

// Documented benign externals (see .claude/plans/W-23059502.md context):
// - vscode: extension host global, always external
// - *-global.js: scripts/bundling inject shims (buffer-global, process-global)
// - vm: asn1.js/lib/asn1/api.js require('vm').runInThisContext in try/catch w/ inline
//   fallback, reached via @salesforce/core crypto + jsforce/browser. Pre-existing infra, benign.
const isAllowed = path => path === 'vscode' || path === 'vm' || /-global\.js$/.test(basename(path));

const builtins = new Set(builtinModules);
const isNodeBuiltin = path => path.startsWith('node:') || builtins.has(path);

// Reads a browser esbuild metafile and throws if it externalizes a non-allowlisted node builtin.
export const assertWebSafe = async metafilePath => {
  const meta = JSON.parse(await readFile(metafilePath, 'utf8'));

  const externals = new Set(
    Object.values(meta.inputs)
      .flatMap(input => input.imports ?? [])
      .filter(imp => imp.external)
      .map(imp => imp.path)
  );

  const violations = [...externals].filter(p => isNodeBuiltin(p) && !isAllowed(p)).sort();

  if (violations.length > 0) {
    throw new Error(
      `assert-web-safe: ${metafilePath} externalizes node builtin(s) outside the web-safe allowlist:\n` +
        violations.map(v => `  - ${v}`).join('\n') +
        '\n  Add a polyfill/alias in scripts/bundling/web.mjs, or (if provably benign) extend the allowlist with a cited rationale.'
    );
  }

  console.log(`assert-web-safe: ${metafilePath} web-safe (${externals.size} external(s), all allowlisted).`);
};

// CLI entry: `node scripts/bundling/assert-web-safe.mjs <metafile>`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const metafilePath = process.argv[2];
  if (!metafilePath) {
    console.error('assert-web-safe: missing metafile path arg');
    process.exit(1);
  }
  assertWebSafe(metafilePath).catch(err => {
    console.error(err.message);
    process.exit(1);
  });
}
